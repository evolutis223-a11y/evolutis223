"use client";

import { useMemo, useRef, useState } from "react";
import { BannerSvg, miniPlateMarkup, tiledBandMarkup } from "@/lib/maquette/svg";
import { soumettreDemande, uploadLogoAction, type DemandeMaquettePayload } from "./actions";

type Donnees = {
  modeles: { id: number; blobUrl: string; tag: string | null }[];
  dispositions: Record<number, { positions: [number, number][]; verrouille: boolean }>;
  badgeForme: string;
  badgeTaille: number;
};
type Forfait = { code: string; id: string; nom: string; prix: number; desc: string; badge?: string };

type Element = { type: "logo"; src: string } | { type: "texte"; content: string };

interface WizardData {
  intent: "maquette" | "pagne" | null;
  depart: "images" | "bibliotheque" | "guide" | null;
  modelesChoisis: number[];
  elements: Element[];
  explication: string;
  nbElements: number | null;
  couleurType: "choisir" | "libre" | null;
  couleurs: string[];
  nom: string;
  telephone: string;
  adresse: string;
  forfait: string | null;
  livraisonMode: "email" | "whatsapp" | "telecharger" | null;
  impressionVoulue: boolean;
}

const STEPS = ["landing", "intent", "depart", "explication", "elements", "couleurs", "contact", "forfait", "recap"] as const;
type Step = (typeof STEPS)[number];

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} F`;
}

export function MaquetteClient({ donnees, forfaits }: { donnees: Donnees; forfaits: Forfait[] }) {
  const [step, setStep] = useState<Step>("landing");
  const [previewSeed, setPreviewSeed] = useState<number | null>(null);
  const [forfaitConfirm, setForfaitConfirm] = useState(false);
  const [envoye, setEnvoye] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Dispositions modifiables localement pendant la session (pas persistées — seul l'admin fige
  // la vraie disposition par défaut, §10ter "je peux les placer... le client n'aura pas la
  // possibilité de les glisser").
  const [dispositions, setDispositions] = useState(donnees.dispositions);

  const [data, setData] = useState<WizardData>({
    intent: null,
    depart: null,
    modelesChoisis: [],
    elements: [],
    explication: "",
    nbElements: null,
    couleurType: null,
    couleurs: [],
    nom: "",
    telephone: "",
    adresse: "",
    forfait: null,
    livraisonMode: null,
    impressionVoulue: false,
  });

  function set<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  const stepIndex = STEPS.indexOf(step);
  function go(delta: number) {
    const next = Math.max(0, Math.min(STEPS.length - 1, stepIndex + delta));
    setStep(STEPS[next]);
  }

  async function handleLogoFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadLogoAction({ error: null }, fd);
      if (res.url) {
        setData((d) => ({ ...d, elements: [...d.elements, { type: "logo", src: res.url! }] }));
      }
    }
  }

  async function handleSubmit() {
    setPending(true);
    setErreur(null);
    const payload: DemandeMaquettePayload = {
      nomClient: data.nom,
      telephoneClient: data.telephone,
      adresseClient: data.adresse,
      intent: data.intent ?? "maquette",
      forfaitCode: forfaits.find((f) => f.id === data.forfait)?.code ?? "",
      details: {
        depart: data.depart,
        modelesChoisis: data.modelesChoisis,
        elements: data.elements,
        nbElements: data.nbElements,
        disposition: data.nbElements ? dispositions[data.nbElements]?.positions ?? [] : [],
        couleurType: data.couleurType,
        couleurs: data.couleurs,
        explication: data.explication,
        livraisonMode: data.livraisonMode,
        impressionVoulue: data.impressionVoulue,
      },
    };
    const res = await soumettreDemande(payload);
    setPending(false);
    if (res.error) setErreur(res.error);
    else setEnvoye(res.numero ?? "");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-0 sm:p-5">
      <div className="relative flex h-screen w-full max-w-[420px] flex-col overflow-hidden bg-white shadow-2xl sm:h-[860px] sm:rounded-[28px]">
        {step !== "landing" && (
          <div className="flex gap-1 px-5 pt-2">
            {STEPS.slice(1).map((s, i) => (
              <button
                key={s}
                onClick={() => setStep(s)}
                className={`h-[5px] flex-1 rounded-full py-2 ${STEPS.indexOf(s) <= stepIndex ? "bg-neutral-900" : "bg-neutral-200"}`}
                style={{ backgroundClip: "content-box", boxSizing: "content-box" }}
              />
            ))}
          </div>
        )}
        <div className="flex flex-1 flex-col overflow-y-auto">
          {step === "landing" && <LandingScreen onNext={() => go(1)} />}
          {step === "intent" && <IntentScreen data={data} set={set} onBack={() => go(-1)} onNext={() => go(1)} />}
          {step === "depart" &&
            (previewSeed !== null ? (
              <ModelPreview
                seed={previewSeed}
                modeles={donnees.modeles}
                data={data}
                set={set}
                onClose={() => setPreviewSeed(null)}
              />
            ) : (
              <DepartScreen data={data} set={set} donnees={donnees} onPreview={setPreviewSeed} onBack={() => go(-1)} onNext={() => go(1)} />
            ))}
          {step === "explication" && (
            <ExplicationScreen data={data} setData={setData} onFiles={handleLogoFiles} onBack={() => go(-1)} onNext={() => go(1)} />
          )}
          {step === "elements" && (
            <ElementsScreen
              data={data}
              set={set}
              dispositions={dispositions}
              setDispositions={setDispositions}
              onBack={() => go(-1)}
              onNext={() => go(1)}
            />
          )}
          {step === "couleurs" && <CouleursScreen data={data} setData={setData} onBack={() => go(-1)} onNext={() => go(1)} />}
          {step === "contact" && <ContactScreen data={data} set={set} onBack={() => go(-1)} onNext={() => go(1)} />}
          {step === "forfait" && (
            <ForfaitScreen
              data={data}
              set={set}
              forfaits={forfaits}
              confirm={forfaitConfirm}
              setConfirm={setForfaitConfirm}
              onBack={() => go(-1)}
              onNext={() => go(1)}
            />
          )}
          {step === "recap" && (
            <RecapScreen
              data={data}
              set={set}
              forfaits={forfaits}
              envoye={envoye}
              erreur={erreur}
              pending={pending}
              onSubmit={handleSubmit}
              onBack={() => go(-1)}
            />
          )}
        </div>
      </div>
    </main>
  );
}

// ---------- Écrans ----------

function NavRow({ onBack, onNext, nextDisabled, nextLabel }: { onBack: () => void; onNext: () => void; nextDisabled?: boolean; nextLabel?: string }) {
  return (
    <div className="mt-auto flex gap-2.5 pt-4">
      <button onClick={onBack} className="rounded-[11px] border border-neutral-200 px-5 py-3 text-sm font-bold">
        ←
      </button>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-1 rounded-[11px] bg-neutral-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-35"
      >
        {nextLabel ?? "Suivant →"}
      </button>
    </div>
  );
}

function LandingScreen({ onNext }: { onNext: () => void }) {
  return (
    <div className="relative flex flex-1 flex-col justify-end overflow-hidden text-white">
      <div className="absolute inset-0">
        <BannerSvg hue={18} />
      </div>
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to top, oklch(0 0 0/.94) 15%, oklch(0 0 0/.15) 60%, oklch(0 0 0/.4))" }}
      />
      <div className="relative p-7 pb-8" style={{ textShadow: "0 2px 10px oklch(0 0 0/.6)" }}>
        <h1 className="mb-1.5 text-[27px] font-extrabold leading-tight text-balance">Votre motif, votre pagne, votre signature</h1>
        <p className="mb-5 text-[13px] opacity-90">
          Confiez-nous votre idée. Nos designers la transforment en maquette prête à produire — sans jargon, sans calcul, juste des choix
          visuels.
        </p>
        <button onClick={onNext} className="w-full rounded-xl bg-white py-4 text-[15px] font-extrabold text-neutral-900">
          Commencer →
        </button>
      </div>
    </div>
  );
}

function IntentScreen({ data, set, onBack, onNext }: { data: WizardData; set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void; onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex flex-1 flex-col p-5">
      <h2 className="mb-1.5 text-xl font-extrabold">Que souhaitez-vous ?</h2>
      <p className="mb-4 text-[12.5px] text-neutral-500">Deux parcours différents — choisissez le vôtre.</p>
      <div className="grid gap-2">
        <ChoiceCard selected={data.intent === "maquette"} onClick={() => set("intent", "maquette")} title="Créer une maquette" desc="Un motif original ou personnalisé, dessiné pour vous" />
        <ChoiceCard selected={data.intent === "pagne"} onClick={() => set("intent", "pagne")} title="Commander un pagne" desc="Avec un modèle déjà existant" />
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextDisabled={!data.intent} />
    </div>
  );
}

function ChoiceCard({ selected, onClick, title, desc, disabled }: { selected?: boolean; onClick?: () => void; title: string; desc?: string; disabled?: boolean }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`rounded-2xl border-2 p-3.5 text-left transition ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer active:scale-[.98]"} ${selected ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"}`}
    >
      <div className="text-[13.5px] font-bold">{title}</div>
      {desc && <div className="mt-0.5 text-[11.5px] text-neutral-500">{desc}</div>}
    </div>
  );
}

function DepartScreen({
  data, set, donnees, onPreview, onBack, onNext,
}: {
  data: WizardData; set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void; donnees: Donnees;
  onPreview: (seed: number) => void; onBack: () => void; onNext: () => void;
}) {
  const canNext = !!data.depart && (data.depart !== "bibliotheque" || data.modelesChoisis.length > 0);
  return (
    <div className="flex flex-1 flex-col p-5">
      <h2 className="mb-1.5 text-xl font-extrabold">Vous avez déjà une idée ?</h2>
      <p className="mb-3.5 text-[12.5px] text-neutral-500">Ça oriente tout de suite le travail du designer.</p>
      <div className="mb-3.5 h-[84px] overflow-hidden rounded-2xl shadow">
        <BannerSvg hue={200} />
      </div>
      <div className="grid gap-2">
        <ChoiceCard selected={data.depart === "images"} onClick={() => set("depart", "images")} title="J'ai des images ou références" />
        <ChoiceCard selected={data.depart === "bibliotheque"} onClick={() => set("depart", "bibliotheque")} title="Parcourir vos modèles existants" />
        <ChoiceCard selected={data.depart === "guide"} onClick={() => set("depart", "guide")} title="Pas d'idée précise, guidez-moi" />
      </div>
      {data.depart === "images" && (
        <div className="mt-2.5 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-5 text-center text-xs text-neutral-500">
          Glissez vos images ici (à venir)
        </div>
      )}
      {data.depart === "bibliotheque" && (
        <>
          {donnees.modeles.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-neutral-200 p-4 text-center text-xs text-neutral-500">
              Aucun modèle dans la bibliothèque pour l&apos;instant.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {donnees.modeles.map((m) => (
                <div
                  key={m.id}
                  onClick={() => onPreview(m.id)}
                  className={`relative aspect-[3/4] cursor-pointer overflow-hidden rounded-lg border-2 ${data.modelesChoisis.includes(m.id) ? "border-neutral-900" : "border-neutral-200"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.blobUrl} alt="" className="h-full w-full object-cover" />
                  {data.modelesChoisis.includes(m.id) && (
                    <div className="absolute right-1 top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-neutral-900 text-[11px] font-extrabold text-white">
                      ✓
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-neutral-500">{data.modelesChoisis.length}/2 modèle(s) choisi(s).</p>
        </>
      )}
      <NavRow onBack={onBack} onNext={onNext} nextDisabled={!canNext} />
    </div>
  );
}

function ModelPreview({
  seed, modeles, data, set, onClose,
}: {
  seed: number; modeles: Donnees["modeles"]; data: WizardData;
  set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void; onClose: () => void;
}) {
  const modele = modeles.find((m) => m.id === seed);
  const chosen = data.modelesChoisis.includes(seed);
  const maxed = data.modelesChoisis.length >= 2 && !chosen;
  function valider() {
    if (chosen) set("modelesChoisis", data.modelesChoisis.filter((x) => x !== seed));
    else if (!maxed) set("modelesChoisis", [...data.modelesChoisis, seed]);
    onClose();
  }
  return (
    <div className="flex flex-1 flex-col p-5">
      <h2 className="mb-1.5 text-xl font-extrabold">Ce modèle vous plaît ?</h2>
      <div className="my-3.5 aspect-[3/4] overflow-hidden rounded-2xl shadow-lg">
        {modele && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={modele.blobUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      {maxed && <p className="text-xs text-red-600">Maximum 2 modèles — retirez-en un pour en choisir un autre.</p>}
      <NavRow onBack={onClose} onNext={valider} nextDisabled={maxed} nextLabel={chosen ? "Retirer ce choix" : "Valider ce choix"} />
    </div>
  );
}

function ExplicationScreen({
  data, setData, onFiles, onBack, onNext,
}: {
  data: WizardData; setData: React.Dispatch<React.SetStateAction<WizardData>>;
  onFiles: (files: FileList | null) => void; onBack: () => void; onNext: () => void;
}) {
  function addTexte() {
    setData((d) => ({ ...d, elements: [...d.elements, { type: "texte", content: "" }] }));
  }
  function removeElement(i: number) {
    setData((d) => ({ ...d, elements: d.elements.filter((_, idx) => idx !== i) }));
  }
  function updateTexte(i: number, val: string) {
    setData((d) => ({ ...d, elements: d.elements.map((el, idx) => (idx === i && el.type === "texte" ? { ...el, content: val } : el)) }));
  }
  return (
    <div className="flex flex-1 flex-col p-5">
      <h2 className="mb-1.5 text-xl font-extrabold">Décrivez ce que vous avez en tête</h2>
      <p className="mb-2.5 text-[12.5px] text-neutral-500">Joignez vos logos et ajoutez des zones de texte — autant que vous voulez.</p>
      {data.elements.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2.5">
          {data.elements.map((el, i) => (
            <div key={i} className="relative w-[58px]">
              <div className="flex h-[58px] w-[58px] items-center justify-center overflow-hidden rounded-[10px] border-2 border-neutral-200 bg-neutral-50">
                {el.type === "logo" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={el.src} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg">✎</span>
                )}
              </div>
              <span className="absolute -left-1.5 -top-1.5 flex h-[19px] w-[19px] items-center justify-center rounded-full bg-neutral-900 text-[10px] font-extrabold text-white">
                {i + 1}
              </span>
              <span
                onClick={() => removeElement(i)}
                className="absolute -right-1.5 -top-1.5 flex h-[19px] w-[19px] cursor-pointer items-center justify-center rounded-full border-[1.5px] border-white bg-black text-xs text-white"
              >
                ×
              </span>
              {el.type === "texte" && (
                <input
                  className="mt-1 w-full rounded-md border border-neutral-200 px-1 py-0.5 text-center text-[9.5px]"
                  placeholder="Texte..."
                  value={el.content}
                  onChange={(e) => updateTexte(i, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-2.5 text-[11.5px] font-semibold text-neutral-500">
          + Ajouter des logos
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        </label>
        <button onClick={addTexte} className="flex-1 rounded-xl border border-neutral-300 bg-white p-2.5 text-[11.5px] font-semibold text-neutral-500">
          + Zone de texte
        </button>
      </div>
      <div className="mb-1.5 mt-3.5 text-[11.5px] font-bold">Expliquez-nous vos recommandations</div>
      <textarea
        className="min-h-[90px] w-full rounded-xl border border-neutral-200 p-3 text-[13.5px]"
        placeholder="Ex. je veux que ce soit comme si... comme ça..."
        value={data.explication}
        onChange={(e) => setData((d) => ({ ...d, explication: e.target.value }))}
      />
      <p className="mt-3 border-t border-neutral-200 pt-3 text-[10.5px] leading-relaxed text-neutral-500">
        Ceci constitue une disposition prise pour une prémaquette — notre équipe technique travaillera ensuite sur votre demande pour la
        réussite du projet. Il est possible qu&apos;un commercial vous rappelle pour éclaircir certains détails dans l&apos;accompagnement.
      </p>
      <NavRow onBack={onBack} onNext={onNext} />
    </div>
  );
}

function ElementsScreen({
  data, set, dispositions, setDispositions, onBack, onNext,
}: {
  data: WizardData; set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void;
  dispositions: Donnees["dispositions"]; setDispositions: React.Dispatch<React.SetStateAction<Donnees["dispositions"]>>;
  onBack: () => void; onNext: () => void;
}) {
  const [vueYards, setVueYards] = useState<6 | 12>(6);
  const tileRef = useRef<HTMLDivElement>(null);
  const n = data.nbElements;
  const dispo = n ? dispositions[n] : null;

  function startDrag(e: React.PointerEvent, i: number) {
    if (!n || dispo?.verrouille || !tileRef.current) return;
    e.preventDefault();
    const rect = tileRef.current.getBoundingClientRect();
    function move(ev: PointerEvent) {
      let x = ((ev.clientX - rect.left) / rect.width) * 100;
      let y = ((ev.clientY - rect.top) / rect.height) * 100;
      x = Math.max(3, Math.min(97, x));
      y = Math.max(3, Math.min(97, y));
      setDispositions((prev) => {
        const cur = prev[n!];
        if (!cur) return prev;
        const positions = cur.positions.map((p, idx) => (idx === i ? ([x, y] as [number, number]) : p));
        return { ...prev, [n!]: { ...cur, positions } };
      });
    }
    function up() {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    }
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  }

  return (
    <div className="flex flex-1 flex-col bg-neutral-950 p-5 text-white">
      <h2 className="mb-1.5 text-xl font-extrabold">Combien d&apos;éléments ?</h2>
      <p className="mb-2.5 text-[12.5px] text-neutral-400">Le rendu réel, répété sur toute la largeur — sans calcul.</p>
      <div className="flex justify-center gap-1.5">
        {[3, 4, 6].map((count) => (
          <div
            key={count}
            onClick={() => set("nbElements", count)}
            className={`w-9 flex-none cursor-pointer rounded-md border-2 bg-neutral-900 p-0.5 ${n === count ? "border-amber-400" : "border-neutral-700"}`}
          >
            <div
              className="aspect-[64/110] w-full"
              dangerouslySetInnerHTML={{ __html: miniPlateMarkup(dispositions[count]?.positions ?? []) }}
            />
            <div className="mt-0.5 text-center text-[8.5px] font-bold text-neutral-300">{count}</div>
          </div>
        ))}
      </div>
      {n && dispo ? (
        <>
          <div
            ref={tileRef}
            className="relative mx-auto mt-2 aspect-[64/110] w-[120px] flex-none overflow-hidden rounded-lg shadow-lg"
            dangerouslySetInnerHTML={{
              __html:
                `<svg viewBox="0 0 64 110" preserveAspectRatio="none" width="100%" height="100%"><rect width="64" height="110" fill="oklch(0.5 0.15 22)"/></svg>` +
                dispo.positions
                  .map(
                    (p, i) =>
                      `<div data-i="${i}" style="position:absolute;left:${p[0]}%;top:${p[1]}%;width:20px;height:15px;margin:-7.5px 0 0 -10px;border-radius:50%;background:oklch(0.97 0.01 90);border:1.5px solid oklch(0.3 0.05 22);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:oklch(0.32 0.06 22);cursor:${dispo.verrouille ? "default" : "grab"}">E</div>`
                  )
                  .join(""),
            }}
            onPointerDown={(e) => {
              const target = (e.target as HTMLElement).closest("[data-i]");
              if (target) startDrag(e, Number(target.getAttribute("data-i")));
            }}
          />
          <div className="mt-1.5 flex items-center gap-1.5">
            <button
              onClick={() => setVueYards(6)}
              className={`flex-none rounded-full border px-2 py-1.5 text-[8.5px] font-bold ${vueYards === 6 ? "border-amber-400 bg-amber-400/15 text-amber-400" : "border-neutral-700 bg-neutral-900 text-neutral-300"}`}
            >
              3 pagnes · 6yd
            </button>
            <span className="flex-1 text-center text-[10px] text-neutral-400">
              {dispo.verrouille ? "Disposition figée par l'atelier" : "Aperçu de l'organisation de votre choix"}
            </span>
            <button
              onClick={() => setVueYards(12)}
              className={`flex-none rounded-full border px-2 py-1.5 text-[8.5px] font-bold ${vueYards === 12 ? "border-amber-400 bg-amber-400/15 text-amber-400" : "border-neutral-700 bg-neutral-900 text-neutral-300"}`}
            >
              1 pièce · 12yd
            </button>
          </div>
          <div
            className="mt-2 flex-1 overflow-hidden"
            style={{ margin: "10px -20px 0" }}
            dangerouslySetInnerHTML={{
              __html: tiledBandMarkup({
                positions: dispo.positions,
                hue: 22,
                repeat: vueYards,
                fit: "slice",
                orient: "h",
                badgeShape: "circle",
                badgeSize: 1,
              }),
            }}
          />
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-neutral-400">
          <span className="animate-bounce text-2xl text-amber-400">↑</span>
          Cliquez sur une plaque ci-dessus
        </div>
      )}
      <div className="mt-3 flex gap-2.5">
        <button onClick={onBack} className="rounded-[11px] border border-neutral-700 bg-neutral-900 px-5 py-3 text-sm font-bold text-white">
          ←
        </button>
        <button
          onClick={onNext}
          disabled={!n}
          className="flex-1 rounded-[11px] bg-amber-400 px-5 py-3 text-sm font-bold text-neutral-900 disabled:opacity-35"
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}

function CouleursScreen({
  data, setData, onBack, onNext,
}: {
  data: WizardData; setData: React.Dispatch<React.SetStateAction<WizardData>>; onBack: () => void; onNext: () => void;
}) {
  const canNext = !!data.couleurType && (data.couleurType !== "choisir" || data.couleurs.length > 0);
  return (
    <div className="flex flex-1 flex-col p-5">
      <h2 className="mb-1.5 text-xl font-extrabold">Quel type de couleur ?</h2>
      <div className="mb-3.5 h-[84px] overflow-hidden rounded-2xl shadow">
        <BannerSvg hue={305} />
      </div>
      <div className="grid gap-2">
        <ChoiceCard selected={data.couleurType === "choisir"} onClick={() => setData((d) => ({ ...d, couleurType: "choisir" }))} title="Choisir mes couleurs" desc="Une ou plusieurs — juste une indication pour le designer" />
        <ChoiceCard selected={data.couleurType === "libre"} onClick={() => setData((d) => ({ ...d, couleurType: "libre" }))} title="Pas de préférence" />
      </div>
      {data.couleurType === "choisir" && (
        <div className="mt-3.5">
          <div className="flex flex-wrap gap-3">
            {data.couleurs.map((c, i) => (
              <div key={i} className="relative h-10 w-10 rounded-full border-2 border-neutral-200 shadow" style={{ background: c }}>
                <input
                  type="color"
                  value={c}
                  onChange={(e) => setData((d) => ({ ...d, couleurs: d.couleurs.map((x, idx) => (idx === i ? e.target.value : x)) }))}
                  className="absolute inset-0 cursor-pointer rounded-full opacity-0"
                />
                <button
                  onClick={() => setData((d) => ({ ...d, couleurs: d.couleurs.filter((_, idx) => idx !== i) }))}
                  className="absolute -right-1.5 -top-1.5 z-10 h-[17px] w-[17px] rounded-full border-[1.5px] border-white bg-black text-[10px] text-white"
                >
                  ×
                </button>
              </div>
            ))}
            <label className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-neutral-300 text-lg text-neutral-500">
              +
              <input
                type="color"
                className="absolute h-10 w-10 cursor-pointer opacity-0"
                onChange={(e) => setData((d) => ({ ...d, couleurs: [...d.couleurs, e.target.value] }))}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-neutral-500">Cliquez une couleur pour la changer.</p>
        </div>
      )}
      <NavRow onBack={onBack} onNext={onNext} nextDisabled={!canNext} />
    </div>
  );
}

function ContactScreen({ data, set, onBack, onNext }: { data: WizardData; set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void; onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex flex-1 flex-col p-5">
      <h2 className="mb-1.5 text-xl font-extrabold">Vos coordonnées</h2>
      <p className="mb-3.5 text-[12.5px] text-neutral-500">Pour vous transmettre la maquette et vous recontacter.</p>
      <div className="mb-3.5 h-[84px] overflow-hidden rounded-2xl shadow">
        <BannerSvg hue={130} />
      </div>
      <div className="space-y-2.5">
        <input className="w-full rounded-xl border border-neutral-200 p-3 text-[13.5px]" placeholder="Votre nom" value={data.nom} onChange={(e) => set("nom", e.target.value)} />
        <input className="w-full rounded-xl border border-neutral-200 p-3 text-[13.5px]" placeholder="+223 ..." value={data.telephone} onChange={(e) => set("telephone", e.target.value)} />
        <input className="w-full rounded-xl border border-neutral-200 p-3 text-[13.5px]" placeholder="Quartier, ville (optionnel)" value={data.adresse} onChange={(e) => set("adresse", e.target.value)} />
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextDisabled={!data.nom || !data.telephone} />
    </div>
  );
}

function ForfaitScreen({
  data, set, forfaits, confirm, setConfirm, onBack, onNext,
}: {
  data: WizardData; set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void; forfaits: Forfait[];
  confirm: boolean; setConfirm: (v: boolean) => void; onBack: () => void; onNext: () => void;
}) {
  const chosen = forfaits.find((f) => f.id === data.forfait);
  if (confirm && chosen) {
    return (
      <div className="flex flex-1 flex-col p-5 text-[#f5ecd8]" style={{ background: "linear-gradient(165deg, #0c0c0c, #1a1610 60%, #0c0c0c)" }}>
        <div className="text-[10.5px] font-bold uppercase tracking-wide text-amber-300">Forfait sélectionné</div>
        <h2 className="mt-1 text-xl font-bold">{chosen.nom}</h2>
        <div className="my-2.5 text-[30px] font-bold text-amber-300">{chosen.prix > 0 ? fmt(chosen.prix) : "Sur devis"}</div>
        <p className="text-[12.5px] text-neutral-300">{chosen.desc}</p>
        <div className="my-3 rounded-xl border border-white/15 bg-white/5 p-3.5 text-xs">
          <div className="flex justify-between border-b border-dashed border-white/15 py-1.5"><span>Forfait</span><b>{chosen.nom}</b></div>
          <div className="flex justify-between py-1.5"><span>Paiement</span><b>Mobile Money / à la livraison</b></div>
        </div>
        <div className="mt-auto flex gap-2.5 pt-4">
          <button onClick={() => setConfirm(false)} className="rounded-[11px] border border-white/20 bg-[#171512] px-5 py-3 text-sm font-bold">← Changer</button>
          <button onClick={onNext} className="flex-1 rounded-[11px] px-5 py-3 text-sm font-extrabold text-[#23190a]" style={{ background: "linear-gradient(135deg, oklch(0.8 0.13 88), oklch(0.63 0.13 70))" }}>
            Continuer →
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col p-5 text-[#f5ecd8]" style={{ background: "linear-gradient(165deg, #0c0c0c, #1a1610 60%, #0c0c0c)" }}>
      <h2 className="mb-1.5 text-xl font-bold">Choisissez votre forfait</h2>
      <p className="mb-3.5 text-[12.5px] text-neutral-300">Maintenant que votre demande est prête.</p>
      <div className="grid gap-2">
        {forfaits.map((f) => (
          <div
            key={f.id}
            onClick={() => {
              set("forfait", f.id);
              setConfirm(true);
            }}
            className={`relative cursor-pointer rounded-2xl border p-3.5 ${data.forfait === f.id ? "border-amber-300" : "border-white/15"}`}
            style={{ background: "linear-gradient(165deg, #1c1a15, #100f0d)" }}
          >
            {f.badge && (
              <span className="absolute -top-2 right-2.5 rounded-full bg-amber-300 px-2 py-0.5 text-[9px] font-extrabold uppercase text-[#3a2a00]">
                {f.badge}
              </span>
            )}
            <div className="text-[15px] font-bold">{f.nom}</div>
            <div className="my-1 text-[17px] font-bold text-amber-300">{f.prix > 0 ? fmt(f.prix) : "Sur devis"}</div>
            <div className="text-xs text-neutral-400">{f.desc}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-neutral-300">Après paiement, un commercial vous contactera pour la prise en charge de votre commande.</p>
      <p className="text-xs text-neutral-300">Une question, un besoin particulier ? Vous pouvez aussi nous contacter directement.</p>
      <div className="mt-3.5 flex gap-2.5">
        <a href="tel:+22374744082" className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-white/15 py-2.5 text-[9.5px] font-semibold">Appeler</a>
        <a href="https://wa.me/22374744082" target="_blank" rel="noopener" className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-white/15 py-2.5 text-[9.5px] font-semibold">WhatsApp</a>
        <a href="mailto:evolutis223@gmail.com" className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-white/15 py-2.5 text-[9.5px] font-semibold">Email</a>
      </div>
      <div className="mt-auto flex gap-2.5 pt-4">
        <button onClick={onBack} className="rounded-[11px] border border-white/20 bg-[#171512] px-5 py-3 text-sm font-bold">←</button>
      </div>
    </div>
  );
}

function RecapScreen({
  data, set, forfaits, envoye, erreur, pending, onSubmit, onBack,
}: {
  data: WizardData; set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void; forfaits: Forfait[];
  envoye: string | null; erreur: string | null; pending: boolean; onSubmit: () => void; onBack: () => void;
}) {
  const f = forfaits.find((x) => x.id === data.forfait);
  if (envoye) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-5 text-center">
        <div className="text-[10.5px] font-bold uppercase text-neutral-500">C&apos;est fait</div>
        <h2 className="mt-1 text-xl font-extrabold">Merci {data.nom} !</h2>
        <p className="mt-2 text-[12.5px] text-neutral-500">
          Votre demande <b>{envoye}</b> est bien enregistrée. Notre équipe vous recontactera très bientôt.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col p-5">
      <div className="text-[10.5px] font-bold uppercase text-neutral-500">C&apos;est prêt</div>
      <h2 className="mt-1 text-xl font-extrabold">Merci {data.nom} !</h2>
      <p className="mb-3 text-[12.5px] text-neutral-500">Votre demande part au studio — un devis suit, établi par l&apos;équipe.</p>
      {f && (
        <div className="mb-2.5 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs">
          <span className="text-neutral-500">Votre livrable ({f.nom}) : </span>
          <b>{f.desc}</b>
        </div>
      )}
      <div>
        <Row k="Forfait" v={f ? `${f.nom} — ${f.prix > 0 ? fmt(f.prix) : "Sur devis"}` : "—"} />
        <Row k="Éléments" v={data.nbElements ? `${data.nbElements} (64×110cm)` : "—"} />
        <Row k="Contact" v={data.telephone || "—"} />
      </div>
      <div className="mb-1.5 mt-3.5 text-[11.5px] font-bold">Comment recevoir votre maquette ?</div>
      <div className="mb-2.5 flex gap-1.5">
        {(["email", "whatsapp", "telecharger"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => set("livraisonMode", mode)}
            className={`flex-1 rounded-[10px] border p-2.5 text-center text-[10px] font-semibold ${data.livraisonMode === mode ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 text-neutral-500"}`}
          >
            {mode === "email" ? "Email" : mode === "whatsapp" ? "WhatsApp" : "Télécharger"}
          </button>
        ))}
      </div>
      <label className="mb-2.5 flex items-start gap-2 text-[11px] text-neutral-500">
        <input type="checkbox" checked={data.impressionVoulue} onChange={(e) => set("impressionVoulue", e.target.checked)} className="mt-0.5" />
        <span>
          Je veux aussi une version imprimée <b>(+ frais supplémentaire et frais de livraison)</b>
        </span>
      </label>
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
      <div className="mt-auto flex gap-2.5 pt-4">
        <button onClick={onBack} className="rounded-[11px] border border-neutral-200 px-5 py-3 text-sm font-bold">←</button>
        <button
          onClick={onSubmit}
          disabled={!data.livraisonMode || pending}
          className="flex-1 rounded-[11px] bg-neutral-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-35"
        >
          {pending ? "Envoi..." : "Envoyer au studio"}
        </button>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-neutral-200 py-2 text-[12.5px]">
      <span className="text-neutral-500">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
