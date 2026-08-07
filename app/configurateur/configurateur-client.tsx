"use client";

import { useMemo, useState } from "react";
import type { ZoneConfig, Technique, Bibliotheque } from "@/lib/calculateurs/marquage";
import { calculerCheminLong, calculerCheminCourt } from "@/lib/configurateur/prix";
import { soumettreCommandePublique, uploadLogoConfigurateurAction, type SoumissionConfigurateur } from "./actions";

type Article = { id: number; code: string; nom: string; prixVente: number; photoUrl: string | null };
type Variante = { id: number; articleId: number; taille: string | null; couleur: string | null; photoUrl: string | null; stockDetail: number };
type Modele = {
  id: number;
  nom: string;
  articleId: number;
  photoUrl: string;
  prixDepart: number;
  zones: { id: string; label: string; technique: string; xPct?: number; yPct?: number; largeurCm?: number; hauteurCm?: number }[];
};
type Finition = { id: number; nom: string; montant: number };

interface Donnees {
  articles: Article[];
  variantes: Variante[];
  modeles: Modele[];
  finitions: Finition[];
  biblio: Bibliotheque;
}

type ZoneLocal = ZoneConfig & { logoUrl?: string | null };

const COUPES = ["Homme", "Femme", "Enfant"];
const TECHNIQUES: { value: Technique; label: string }[] = [
  { value: "SERIGRAPHIE", label: "Sérigraphie" },
  { value: "DTF", label: "DTF" },
  { value: "SUBLIMATION", label: "Sublimation" },
  { value: "FLOCAGE", label: "Flocage" },
  { value: "BRODERIE", label: "Broderie" },
];

let localIdCounter = 1;
function nextLocalId() {
  return `z${localIdCounter++}`;
}
function fmt(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

export function ConfigurateurClient({ donnees }: { donnees: Donnees }) {
  const [chemin, setChemin] = useState<"court" | "long" | null>(null);
  const [etape, setEtape] = useState(0);

  // Chemin long
  const [articleId, setArticleId] = useState<number | null>(null);
  const [coupe, setCoupe] = useState("Homme");
  const [zones, setZones] = useState<ZoneLocal[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [finitionIds, setFinitionIds] = useState<number[]>([]);

  // Chemin court
  const [modeleId, setModeleId] = useState<number | null>(null);
  const [logosParZoneCourt, setLogosParZoneCourt] = useState<Record<string, string>>({});

  // Partagé
  const [couleur, setCouleur] = useState<string | null>(null);
  const [tailleQte, setTailleQte] = useState<Record<string, number>>({});
  const [nomClient, setNomClient] = useState("");
  const [telephoneClient, setTelephoneClient] = useState("");
  const [modeFinalisation, setModeFinalisation] = useState<"RETRAIT" | "LIVRAISON">("RETRAIT");
  const [adresseLivraison, setAdresseLivraison] = useState("");
  const [uploadingZoneId, setUploadingZoneId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{
    numero: string;
    total: number;
    paiement?: { ok: boolean; transactionId?: string; error?: string };
  } | null>(null);

  const article = useMemo(() => donnees.articles.find((a) => a.id === articleId) ?? null, [articleId, donnees.articles]);
  const modele = useMemo(() => donnees.modeles.find((m) => m.id === modeleId) ?? null, [modeleId, donnees.modeles]);
  const articleActif = chemin === "court" ? donnees.articles.find((a) => a.id === modele?.articleId) ?? null : article;

  const variantesArticle = useMemo(
    () => (articleActif ? donnees.variantes.filter((v) => v.articleId === articleActif.id) : []),
    [articleActif, donnees.variantes]
  );
  const couleurs = useMemo(() => {
    const set = new Map<string, boolean>();
    for (const v of variantesArticle) {
      if (!v.couleur) continue;
      const dispo = set.get(v.couleur) ?? false;
      set.set(v.couleur, dispo || v.stockDetail > 0);
    }
    return [...set.entries()].map(([nom, dispo]) => ({ nom, dispo }));
  }, [variantesArticle]);
  const tailles = useMemo(
    () => [...new Set(variantesArticle.filter((v) => v.couleur === couleur).map((v) => v.taille).filter(Boolean))] as string[],
    [variantesArticle, couleur]
  );
  const photoActuelle = useMemo(() => {
    const v = variantesArticle.find((v) => v.couleur === couleur && v.photoUrl);
    return v?.photoUrl ?? articleActif?.photoUrl ?? null;
  }, [variantesArticle, couleur, articleActif]);

  const quantiteTotale = Object.values(tailleQte).reduce((a, b) => a + (b || 0), 0);

  const finitionsSelectionnees = useMemo(
    () => donnees.finitions.filter((f) => finitionIds.includes(f.id)),
    [finitionIds, donnees.finitions]
  );

  const calculLong = useMemo(
    () =>
      article
        ? calculerCheminLong(
            { prixArticle: article.prixVente, zones, finitions: finitionsSelectionnees, quantiteTotale: quantiteTotale || 1 },
            donnees.biblio
          )
        : null,
    [article, zones, finitionsSelectionnees, quantiteTotale, donnees.biblio]
  );
  const totalCourt = modele ? calculerCheminCourt(modele.prixDepart, quantiteTotale || 1) : 0;

  function choisirChemin(c: "court" | "long") {
    setChemin(c);
    setEtape(1);
  }

  function selectionnerArticleLong(id: number) {
    setArticleId(id);
    setCouleur(null);
    setZones([]);
    setSelectedZoneId(null);
    setTailleQte({});
  }

  function selectionnerModele(id: number) {
    setModeleId(id);
    setCouleur(null);
    setLogosParZoneCourt({});
    setTailleQte({});
  }

  function addZone(x: number, y: number) {
    const z: ZoneLocal = {
      id: nextLocalId(),
      label: `Zone ${zones.length + 1}`,
      technique: "SERIGRAPHIE",
      largeurCm: 10,
      hauteurCm: 10,
      cadreId: donnees.biblio.cadres[0]?.id ?? null,
      encreId: null,
      supportId: null,
      palierBroderieId: donnees.biblio.paliersBroderie[0]?.id ?? null,
      logoUrl: null,
    };
    setZones((prev) => [...prev, z]);
    setSelectedZoneId(z.id);
  }

  function updateZone(id: string, patch: Partial<ZoneLocal>) {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  }

  function onTechniqueChange(id: string, technique: Technique) {
    const patch: Partial<ZoneLocal> = { technique };
    const b = donnees.biblio;
    if (technique === "DTF") {
      patch.encreId = b.encres.find((e) => e.technique === "DTF")?.id ?? null;
      patch.supportId = b.supports.find((s) => s.technique === "DTF")?.id ?? null;
    } else if (technique === "SUBLIMATION") {
      patch.encreId = b.encres.find((e) => e.technique === "SUBLIMATION")?.id ?? null;
      patch.supportId = b.supports.find((s) => s.technique === "SUBLIMATION")?.id ?? null;
    } else if (technique === "FLOCAGE") {
      patch.supportId = b.supports.find((s) => s.technique === "FLOCAGE")?.id ?? null;
    }
    updateZone(id, patch);
  }

  async function handleUploadZoneLogo(zoneId: string, file: File) {
    setUploadingZoneId(zoneId);
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadLogoConfigurateurAction({ error: null }, fd);
    setUploadingZoneId(null);
    if (res.error || !res.url) {
      setErreur(res.error ?? "Échec de l'envoi du logo.");
      return;
    }
    updateZone(zoneId, { logoUrl: res.url });
  }

  async function handleUploadModeleLogo(zoneId: string, file: File) {
    setUploadingZoneId(zoneId);
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadLogoConfigurateurAction({ error: null }, fd);
    setUploadingZoneId(null);
    if (res.error || !res.url) {
      setErreur(res.error ?? "Échec de l'envoi du logo.");
      return;
    }
    setLogosParZoneCourt((prev) => ({ ...prev, [zoneId]: res.url! }));
  }

  const lignesSoumission = tailles
    .map((t) => ({ taille: t, quantite: tailleQte[t] || 0 }))
    .filter((l) => l.quantite > 0);

  async function handleSubmit() {
    if (!couleur) {
      setErreur("Choisissez une couleur.");
      return;
    }
    if (lignesSoumission.length === 0) {
      setErreur("Renseignez au moins une taille/quantité.");
      return;
    }
    if (!nomClient.trim() || !telephoneClient.trim()) {
      setErreur("Nom et téléphone requis.");
      return;
    }
    if (modeFinalisation === "LIVRAISON" && !adresseLivraison.trim()) {
      setErreur("Adresse de livraison requise.");
      return;
    }
    setSubmitting(true);
    setErreur(null);

    const payload: SoumissionConfigurateur =
      chemin === "court"
        ? {
            chemin: "court",
            modeleId: modele!.id,
            couleur,
            logosParZone: logosParZoneCourt,
            lignes: lignesSoumission,
            nomClient: nomClient.trim(),
            telephoneClient: telephoneClient.trim(),
            modeFinalisation,
            adresseLivraison: modeFinalisation === "LIVRAISON" ? adresseLivraison.trim() : null,
          }
        : {
            chemin: "long",
            articleId: article!.id,
            couleur,
            coupe,
            zones,
            finitionIds,
            lignes: lignesSoumission,
            nomClient: nomClient.trim(),
            telephoneClient: telephoneClient.trim(),
            modeFinalisation,
            adresseLivraison: modeFinalisation === "LIVRAISON" ? adresseLivraison.trim() : null,
          };

    const res = await soumettreCommandePublique(payload);
    setSubmitting(false);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    setResultat({ numero: res.numero ?? `CDE-${res.affaireId}`, total: res.total ?? 0, paiement: res.paiementMobileMoney });
  }

  if (resultat) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-xs font-bold uppercase tracking-widest text-primary">C&apos;est fait</div>
        <h1 className="text-2xl font-bold text-foreground">Merci {nomClient} !</h1>
        <p className="text-sm text-muted-foreground">
          Votre commande est enregistrée pour un total de <b className="text-foreground">{fmt(resultat.total)}</b>. Notre équipe la
          confirme sous peu — vous serez recontacté au {telephoneClient}.
        </p>
        {resultat.paiement?.ok ? (
          <p className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
            Une demande de paiement Mobile Money vient de vous être envoyée au {telephoneClient}. Confirmez-la sur votre téléphone
            pour finaliser le règlement.
          </p>
        ) : (
          <p className="mt-2 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
            Le paiement Mobile Money en ligne n&apos;est pas disponible pour le moment — notre équipe vous contactera pour convenir
            du règlement.
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl p-6">
      <div className="mb-1 text-[10.5px] font-bold uppercase tracking-widest text-primary">EVOLUTIS223 — Configurateur</div>

      {etape === 0 && (
        <div>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Que souhaitez-vous ?</h1>
          <p className="mt-1 text-sm text-muted-foreground">Deux chemins possibles — choisissez le vôtre.</p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={() => choisirChemin("court")}
              className="rounded-lg border border-border bg-card p-5 text-left hover:border-primary"
            >
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-primary">Chemin court</div>
              <div className="mt-1 text-sm font-semibold text-foreground">Un modèle déjà prêt</div>
              <div className="mt-1 text-xs text-muted-foreground">Choisissez un modèle existant, envoyez votre logo, c&apos;est tout.</div>
            </button>
            <button
              onClick={() => choisirChemin("long")}
              className="rounded-lg border border-border bg-card p-5 text-left hover:border-primary"
            >
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-primary">Chemin long</div>
              <div className="mt-1 text-sm font-semibold text-foreground">Configuration à la carte</div>
              <div className="mt-1 text-xs text-muted-foreground">Aucun modèle ne vous convient ? Construisez votre article de A à Z.</div>
            </button>
          </div>
        </div>
      )}

      {chemin === "court" && etape >= 1 && (
        <CheminCourtWizard
          etape={etape}
          setEtape={setEtape}
          donnees={donnees}
          modele={modele}
          modeleId={modeleId}
          selectionnerModele={selectionnerModele}
          couleur={couleur}
          setCouleur={setCouleur}
          couleurs={couleurs}
          tailles={tailles}
          tailleQte={tailleQte}
          setTailleQte={setTailleQte}
          quantiteTotale={quantiteTotale}
          photoActuelle={photoActuelle}
          logosParZoneCourt={logosParZoneCourt}
          onUploadZone={handleUploadModeleLogo}
          uploadingZoneId={uploadingZoneId}
          totalCourt={totalCourt}
          nomClient={nomClient}
          setNomClient={setNomClient}
          telephoneClient={telephoneClient}
          setTelephoneClient={setTelephoneClient}
          modeFinalisation={modeFinalisation}
          setModeFinalisation={setModeFinalisation}
          adresseLivraison={adresseLivraison}
          setAdresseLivraison={setAdresseLivraison}
          onSubmit={handleSubmit}
          submitting={submitting}
          erreur={erreur}
        />
      )}

      {chemin === "long" && etape >= 1 && (
        <CheminLongWizard
          etape={etape}
          setEtape={setEtape}
          donnees={donnees}
          article={article}
          articleId={articleId}
          selectionnerArticle={selectionnerArticleLong}
          coupe={coupe}
          setCoupe={setCoupe}
          couleur={couleur}
          setCouleur={setCouleur}
          couleurs={couleurs}
          photoActuelle={photoActuelle}
          zones={zones}
          addZone={addZone}
          updateZone={updateZone}
          onTechniqueChange={onTechniqueChange}
          selectedZoneId={selectedZoneId}
          setSelectedZoneId={setSelectedZoneId}
          onUploadZoneLogo={handleUploadZoneLogo}
          uploadingZoneId={uploadingZoneId}
          finitionIds={finitionIds}
          setFinitionIds={setFinitionIds}
          tailles={tailles}
          tailleQte={tailleQte}
          setTailleQte={setTailleQte}
          quantiteTotale={quantiteTotale}
          calcul={calculLong}
          nomClient={nomClient}
          setNomClient={setNomClient}
          telephoneClient={telephoneClient}
          setTelephoneClient={setTelephoneClient}
          modeFinalisation={modeFinalisation}
          setModeFinalisation={setModeFinalisation}
          adresseLivraison={adresseLivraison}
          setAdresseLivraison={setAdresseLivraison}
          onSubmit={handleSubmit}
          submitting={submitting}
          erreur={erreur}
        />
      )}
    </main>
  );
}

function Nav({ onBack, onNext, nextDisabled, nextLabel = "Suivant →" }: { onBack: () => void; onNext?: () => void; nextDisabled?: boolean; nextLabel?: string }) {
  return (
    <div className="mt-5 flex gap-2">
      <button onClick={onBack} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
        ←
      </button>
      {onNext && (
        <button
          onClick={onNext}
          disabled={nextDisabled}
          className="flex-1 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}

function ColorPicker({
  couleurs,
  couleur,
  setCouleur,
}: {
  couleurs: { nom: string; dispo: boolean }[];
  couleur: string | null;
  setCouleur: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {couleurs.map((c) => (
        <button
          key={c.nom}
          disabled={!c.dispo}
          onClick={() => setCouleur(c.nom)}
          title={c.dispo ? c.nom : `${c.nom} — rupture`}
          className={`rounded-full border-2 px-3 py-1.5 text-xs font-semibold ${
            couleur === c.nom ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
          } ${!c.dispo ? "opacity-30" : "hover:border-primary"}`}
        >
          {c.nom}
        </button>
      ))}
      {couleurs.length === 0 && <p className="text-xs text-muted-foreground">Aucune couleur disponible pour cet article.</p>}
    </div>
  );
}

function TailleQte({ tailles, tailleQte, setTailleQte }: { tailles: string[]; tailleQte: Record<string, number>; setTailleQte: (v: Record<string, number>) => void }) {
  const total = Object.values(tailleQte).reduce((a, b) => a + (b || 0), 0);
  return (
    <div>
      <div className="flex flex-col gap-2">
        {tailles.map((t) => (
          <div key={t} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
            <span className="text-sm text-foreground">{t}</span>
            <input
              type="number"
              min={0}
              value={tailleQte[t] ?? 0}
              onChange={(e) => setTailleQte({ ...tailleQte, [t]: Math.max(0, Number(e.target.value)) })}
              className="h-8 w-16 rounded-md border border-input bg-background px-2 text-center text-sm"
            />
          </div>
        ))}
        {tailles.length === 0 && <p className="text-xs text-muted-foreground">Choisissez d&apos;abord une couleur.</p>}
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        Total : <b className="text-foreground">{total} pièce{total > 1 ? "s" : ""}</b>
      </div>
    </div>
  );
}

function ContactLivraison({
  nomClient,
  setNomClient,
  telephoneClient,
  setTelephoneClient,
  modeFinalisation,
  setModeFinalisation,
  adresseLivraison,
  setAdresseLivraison,
}: {
  nomClient: string;
  setNomClient: (v: string) => void;
  telephoneClient: string;
  setTelephoneClient: (v: string) => void;
  modeFinalisation: "RETRAIT" | "LIVRAISON";
  setModeFinalisation: (v: "RETRAIT" | "LIVRAISON") => void;
  adresseLivraison: string;
  setAdresseLivraison: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <input
        value={nomClient}
        onChange={(e) => setNomClient(e.target.value)}
        placeholder="Votre nom"
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
      />
      <input
        value={telephoneClient}
        onChange={(e) => setTelephoneClient(e.target.value)}
        placeholder="+223 ..."
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
      />
      <div className="flex gap-2">
        <button
          onClick={() => setModeFinalisation("RETRAIT")}
          className={`flex-1 rounded-md border px-3 py-2 text-sm ${modeFinalisation === "RETRAIT" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
        >
          Retrait
        </button>
        <button
          onClick={() => setModeFinalisation("LIVRAISON")}
          className={`flex-1 rounded-md border px-3 py-2 text-sm ${modeFinalisation === "LIVRAISON" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
        >
          Livraison
        </button>
      </div>
      {modeFinalisation === "LIVRAISON" && (
        <input
          value={adresseLivraison}
          onChange={(e) => setAdresseLivraison(e.target.value)}
          placeholder="Adresse de livraison"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
      )}
      <p className="text-[11px] text-muted-foreground">
        Paiement : espèces à la livraison/retrait ou Mobile Money — un commercial vous contactera pour le règlement.
      </p>
    </div>
  );
}

interface CheminCourtWizardProps {
  etape: number;
  setEtape: (n: number) => void;
  donnees: Donnees;
  modele: Modele | null;
  modeleId: number | null;
  selectionnerModele: (id: number) => void;
  couleur: string | null;
  setCouleur: (c: string) => void;
  couleurs: { nom: string; dispo: boolean }[];
  tailles: string[];
  tailleQte: Record<string, number>;
  setTailleQte: (v: Record<string, number>) => void;
  quantiteTotale: number;
  photoActuelle: string | null;
  logosParZoneCourt: Record<string, string>;
  onUploadZone: (zoneId: string, file: File) => void;
  uploadingZoneId: string | null;
  totalCourt: number;
  nomClient: string;
  setNomClient: (v: string) => void;
  telephoneClient: string;
  setTelephoneClient: (v: string) => void;
  modeFinalisation: "RETRAIT" | "LIVRAISON";
  setModeFinalisation: (v: "RETRAIT" | "LIVRAISON") => void;
  adresseLivraison: string;
  setAdresseLivraison: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  erreur: string | null;
}

function CheminCourtWizard(p: CheminCourtWizardProps) {
  const totalEtapes = 7;
  return (
    <div>
      <div className="mb-4 text-xs text-muted-foreground">Chemin court — étape {p.etape} / {totalEtapes}</div>

      {p.etape === 1 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground">Choix du modèle</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {p.donnees.modeles.map((m) => (
              <button
                key={m.id}
                onClick={() => p.selectionnerModele(m.id)}
                className={`rounded-lg border-2 p-2 text-left ${p.modeleId === m.id ? "border-primary" : "border-border"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.photoUrl} alt="" className="aspect-[4/5] w-full rounded-md object-cover" />
                <div className="mt-1.5 text-xs font-semibold text-foreground">{m.nom}</div>
                <div className="text-[11px] text-primary">à partir de {fmt(m.prixDepart)}</div>
              </button>
            ))}
            {p.donnees.modeles.length === 0 && <p className="col-span-2 text-xs text-muted-foreground">Aucun modèle disponible pour l&apos;instant.</p>}
          </div>
          <Nav onBack={() => p.setEtape(0)} onNext={() => p.setEtape(2)} nextDisabled={!p.modele} />
        </div>
      )}

      {p.etape === 2 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground">Couleur</h2>
          <div className="mt-3">
            <ColorPicker couleurs={p.couleurs} couleur={p.couleur} setCouleur={p.setCouleur} />
          </div>
          <Nav onBack={() => p.setEtape(1)} onNext={() => p.setEtape(3)} nextDisabled={!p.couleur} />
        </div>
      )}

      {p.etape === 3 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground">Taille &amp; quantité</h2>
          <div className="mt-3">
            <TailleQte tailles={p.tailles} tailleQte={p.tailleQte} setTailleQte={p.setTailleQte} />
          </div>
          <Nav onBack={() => p.setEtape(2)} onNext={() => p.setEtape(4)} nextDisabled={p.quantiteTotale === 0} />
        </div>
      )}

      {p.etape === 4 && p.modele && (
        <div>
          <h2 className="text-lg font-semibold text-foreground">Envoi du logo</h2>
          <p className="mt-1 text-xs text-muted-foreground">Une zone de dépôt par emplacement prévu.</p>
          <div className="mt-3 flex flex-col gap-2">
            {p.modele.zones.map((z) => (
              <div key={z.id} className="rounded-md border border-border bg-card p-3">
                <div className="mb-1.5 text-xs font-semibold text-foreground">{z.label}</div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && p.onUploadZone(z.id, e.target.files[0])}
                  className="text-xs"
                />
                {p.uploadingZoneId === z.id && <span className="ml-2 text-[11px] text-muted-foreground">Envoi...</span>}
                {p.logosParZoneCourt[z.id] && <span className="ml-2 text-[11px] text-primary">✓ envoyé</span>}
              </div>
            ))}
          </div>
          <Nav onBack={() => p.setEtape(3)} onNext={() => p.setEtape(5)} />
        </div>
      )}

      {p.etape === 5 && p.modele && (
        <div>
          <h2 className="text-lg font-semibold text-foreground">Présentation</h2>
          <div className="relative mt-3 overflow-hidden rounded-lg border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.photoActuelle ?? p.modele.photoUrl} alt="" className="aspect-[4/5] w-full object-cover" />
            {p.modele.zones.map((z) => {
              const url = p.logosParZoneCourt[z.id];
              if (!url) return null;
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={z.id}
                  src={url}
                  alt=""
                  className="absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded border-2 border-background bg-background object-contain"
                  style={{ left: `${z.xPct ?? 50}%`, top: `${z.yPct ?? 30}%` }}
                />
              );
            })}
          </div>
          <Nav onBack={() => p.setEtape(4)} onNext={() => p.setEtape(6)} />
        </div>
      )}

      {p.etape === 6 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground">Prix</h2>
          <div className="mt-3 rounded-md border border-border bg-card p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{p.modele?.nom} × {p.quantiteTotale}</span>
              <span className="font-bold text-foreground">{fmt(p.totalCourt)}</span>
            </div>
          </div>
          <Nav onBack={() => p.setEtape(5)} onNext={() => p.setEtape(7)} />
        </div>
      )}

      {p.etape === 7 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground">Coordonnées &amp; livraison</h2>
          <div className="mt-3">
            <ContactLivraison
              nomClient={p.nomClient}
              setNomClient={p.setNomClient}
              telephoneClient={p.telephoneClient}
              setTelephoneClient={p.setTelephoneClient}
              modeFinalisation={p.modeFinalisation}
              setModeFinalisation={p.setModeFinalisation}
              adresseLivraison={p.adresseLivraison}
              setAdresseLivraison={p.setAdresseLivraison}
            />
          </div>
          {p.erreur && <p className="mt-2 text-xs text-destructive">{p.erreur}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={() => p.setEtape(6)} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground">←</button>
            <button
              onClick={p.onSubmit}
              disabled={p.submitting}
              className="flex-1 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              {p.submitting ? "Envoi..." : `Valider — ${fmt(p.totalCourt)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface CheminLongWizardProps {
  etape: number;
  setEtape: (n: number) => void;
  donnees: Donnees;
  article: Article | null;
  articleId: number | null;
  selectionnerArticle: (id: number) => void;
  coupe: string;
  setCoupe: (c: string) => void;
  couleur: string | null;
  setCouleur: (c: string) => void;
  couleurs: { nom: string; dispo: boolean }[];
  photoActuelle: string | null;
  zones: ZoneLocal[];
  addZone: (x: number, y: number) => void;
  updateZone: (id: string, patch: Partial<ZoneLocal>) => void;
  onTechniqueChange: (id: string, t: Technique) => void;
  selectedZoneId: string | null;
  setSelectedZoneId: (id: string | null) => void;
  onUploadZoneLogo: (zoneId: string, file: File) => void;
  uploadingZoneId: string | null;
  finitionIds: number[];
  setFinitionIds: (v: number[]) => void;
  tailles: string[];
  tailleQte: Record<string, number>;
  setTailleQte: (v: Record<string, number>) => void;
  quantiteTotale: number;
  calcul: ReturnType<typeof calculerCheminLong> | null;
  nomClient: string;
  setNomClient: (v: string) => void;
  telephoneClient: string;
  setTelephoneClient: (v: string) => void;
  modeFinalisation: "RETRAIT" | "LIVRAISON";
  setModeFinalisation: (v: "RETRAIT" | "LIVRAISON") => void;
  adresseLivraison: string;
  setAdresseLivraison: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  erreur: string | null;
}

function CheminLongWizard(p: CheminLongWizardProps) {
  const selectedZone = p.zones.find((z) => z.id === p.selectedZoneId) ?? null;
  const totalEtapes = 6;
  return (
    <div>
      <div className="mb-4 text-xs text-muted-foreground">Chemin long — étape {p.etape} / {totalEtapes}</div>

      {p.etape === 1 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground">① Support</h2>
          <select
            value={p.articleId ?? ""}
            onChange={(e) => p.selectionnerArticle(Number(e.target.value))}
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Choisir un article...</option>
            {p.donnees.articles.map((a) => (
              <option key={a.id} value={a.id}>{a.nom} ({a.code})</option>
            ))}
          </select>
          {p.article && (
            <>
              {p.photoActuelle && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photoActuelle} alt="" className="mt-3 aspect-[4/5] w-40 rounded-md object-cover" />
              )}
              <div className="mt-3 text-xs text-muted-foreground">Couleur</div>
              <div className="mt-1.5"><ColorPicker couleurs={p.couleurs} couleur={p.couleur} setCouleur={p.setCouleur} /></div>
              <div className="mt-3 text-xs text-muted-foreground">Coupe</div>
              <div className="mt-1.5 flex gap-2">
                {COUPES.map((c) => (
                  <button
                    key={c}
                    onClick={() => p.setCoupe(c)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${p.coupe === c ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}
          <Nav onBack={() => p.setEtape(0)} onNext={() => p.setEtape(2)} nextDisabled={!p.article || !p.couleur} />
        </div>
      )}

      {p.etape === 2 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground">② Zones de marquage</h2>
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              p.addZone(((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100);
            }}
            className="relative mt-2 h-64 cursor-crosshair overflow-hidden rounded-md border border-border bg-muted"
          >
            {p.photoActuelle ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photoActuelle} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Cliquez pour placer une zone</div>
            )}
            {p.zones.map((z, i) => (
              <button
                key={z.id}
                onClick={(e) => { e.stopPropagation(); p.setSelectedZoneId(z.id); }}
                className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-background bg-primary text-[11px] font-bold text-primary-foreground shadow"
              >
                {i + 1}
              </button>
            ))}
          </div>
          {selectedZone && (
            <div className="mt-3 rounded-md border border-border bg-card p-3">
              <input
                value={selectedZone.label}
                onChange={(e) => p.updateZone(selectedZone.id, { label: e.target.value })}
                className="mb-2 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              />
              <select
                value={selectedZone.technique}
                onChange={(e) => p.onTechniqueChange(selectedZone.id, e.target.value as Technique)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                {TECHNIQUES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <div className="mt-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && p.onUploadZoneLogo(selectedZone.id, e.target.files[0])}
                  className="text-xs"
                />
                {p.uploadingZoneId === selectedZone.id && <span className="ml-2 text-[11px] text-muted-foreground">Envoi...</span>}
                {selectedZone.logoUrl && <span className="ml-2 text-[11px] text-primary">✓ logo envoyé</span>}
              </div>
            </div>
          )}
          <Nav onBack={() => p.setEtape(1)} onNext={() => p.setEtape(3)} />
        </div>
      )}

      {p.etape === 3 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground">③ Finitions</h2>
          <div className="mt-2 flex flex-col gap-2">
            {p.donnees.finitions.map((f) => {
              const checked = p.finitionIds.includes(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => p.setFinitionIds(checked ? p.finitionIds.filter((id) => id !== f.id) : [...p.finitionIds, f.id])}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${checked ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <span className="text-foreground">{checked ? "☑" : "☐"} {f.nom}</span>
                  <span className="text-xs text-primary">+{fmt(f.montant)}</span>
                </button>
              );
            })}
            {p.donnees.finitions.length === 0 && <p className="text-xs text-muted-foreground">Aucune finition disponible.</p>}
          </div>
          <Nav onBack={() => p.setEtape(2)} onNext={() => p.setEtape(4)} />
        </div>
      )}

      {p.etape === 4 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground">④ Taille &amp; quantité</h2>
          <div className="mt-2">
            <TailleQte tailles={p.tailles} tailleQte={p.tailleQte} setTailleQte={p.setTailleQte} />
          </div>
          <Nav onBack={() => p.setEtape(3)} onNext={() => p.setEtape(5)} nextDisabled={p.quantiteTotale === 0} />
        </div>
      )}

      {p.etape === 5 && p.calcul && (
        <div>
          <h2 className="text-lg font-semibold text-foreground">⑤ Récapitulatif</h2>
          <div className="mt-2 rounded-md border border-border bg-card p-4 text-sm">
            <div className="flex justify-between border-b border-border py-1.5"><span className="text-muted-foreground">Support</span><span className="text-foreground">{p.article?.nom} — {p.couleur} — {p.coupe}</span></div>
            <div className="flex justify-between border-b border-border py-1.5"><span className="text-muted-foreground">Zones</span><span className="text-foreground">{p.zones.length}</span></div>
            <div className="flex justify-between border-b border-border py-1.5"><span className="text-muted-foreground">Finitions</span><span className="text-foreground">{p.finitionIds.length || "—"}</span></div>
            <div className="flex justify-between border-b border-border py-1.5"><span className="text-muted-foreground">Quantité</span><span className="text-foreground">{p.quantiteTotale} pièces</span></div>
            <div className="mt-2 flex flex-col gap-1 text-[11px] text-muted-foreground">
              <div className="flex justify-between"><span>Base ({p.quantiteTotale} × {fmt(p.calcul.prixUnitaireBase)})</span><span>{fmt(p.calcul.prixUnitaireBase * p.quantiteTotale)}</span></div>
              {p.calcul.prixUnitaireZones > 0 && <div className="flex justify-between"><span>Marquage ({p.quantiteTotale} × {fmt(p.calcul.prixUnitaireZones)})</span><span>{fmt(p.calcul.prixUnitaireZones * p.quantiteTotale)}</span></div>}
              {p.calcul.prixUnitaireFinitions > 0 && <div className="flex justify-between"><span>Finitions ({p.quantiteTotale} × {fmt(p.calcul.prixUnitaireFinitions)})</span><span>{fmt(p.calcul.prixUnitaireFinitions * p.quantiteTotale)}</span></div>}
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2">
              <span className="text-muted-foreground">Total</span>
              <span className="text-xl font-bold text-foreground">{fmt(p.calcul.total)}</span>
            </div>
          </div>
          <div className="mt-4">
            <ContactLivraison
              nomClient={p.nomClient}
              setNomClient={p.setNomClient}
              telephoneClient={p.telephoneClient}
              setTelephoneClient={p.setTelephoneClient}
              modeFinalisation={p.modeFinalisation}
              setModeFinalisation={p.setModeFinalisation}
              adresseLivraison={p.adresseLivraison}
              setAdresseLivraison={p.setAdresseLivraison}
            />
          </div>
          {p.erreur && <p className="mt-2 text-xs text-destructive">{p.erreur}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={() => p.setEtape(4)} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground">←</button>
            <button
              onClick={p.onSubmit}
              disabled={p.submitting}
              className="flex-1 rounded-md bg-green-700 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {p.submitting ? "Envoi..." : "✓ Valider"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
