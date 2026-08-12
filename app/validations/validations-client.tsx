"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AppShell, type ShellModule } from "@/components/app-shell";
import { AideBulle } from "@/components/ui/aide-bulle";
import {
  autoriserDemande,
  listerDemandesEnAttente,
  rechargerDemande,
  refuserDemande,
  refuserDemandeMaquette,
  refuserProforma,
  validerDemandeMaquette,
  validerProforma,
} from "./actions";
import { chargerAvisEtMessagesEnAttente, marquerMessageContactLu, traiterAvisSite } from "@/app/site/actions";

type Demande = Awaited<ReturnType<typeof listerDemandesEnAttente>>[number];
interface Proforma {
  id: number;
  numero: string;
  statut: string;
  montantTtc: string;
  clientNom: string;
  auteurNom: string;
  dateCreation: Date;
}
interface DemandeMaquetteDetails {
  depart: string | null;
  modelesChoisis: number[];
  imagesReferences?: string[];
  elements: { type: "logo" | "texte"; src?: string; content?: string }[];
  couleurType: string | null;
  couleurs: string[];
  explication: string;
  livraisonMode: string | null;
  impressionVoulue: boolean;
}
interface DemandeMaquette {
  id: number;
  numero: string;
  statut: string;
  nomClient: string;
  telephoneClient: string;
  intent: string;
  forfaitNom: string | null;
  forfaitPrix: string | null;
  dateCreation: Date;
  details: unknown;
}

const COULEUR_TYPE_LABEL: Record<string, string> = { choisir: "Palette proposée", libre: "Couleurs libres" };
const LIVRAISON_LABEL: Record<string, string> = { email: "Par email", whatsapp: "Par WhatsApp", telecharger: "À télécharger" };

function DemandeMaquetteDetail({ details }: { details: unknown }) {
  const d = details as DemandeMaquetteDetails | null;
  if (!d) return <p className="mt-2 text-xs text-muted-foreground">Aucun détail enregistré.</p>;
  const hasElements = d.elements?.length > 0;
  const hasImages = (d.imagesReferences?.length ?? 0) > 0;
  return (
    <div className="mt-2 rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs">
      {d.explication && (
        <p className="text-card-foreground">
          <span className="font-medium text-muted-foreground">Explication du client : </span>
          {d.explication}
        </p>
      )}
      {hasImages && (
        <div className="mt-2">
          <div className="font-medium text-muted-foreground">Images de référence envoyées :</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {d.imagesReferences!.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="h-14 w-14 rounded-md border border-border object-cover" />
            ))}
          </div>
        </div>
      )}
      {hasElements && (
        <div className="mt-2">
          <div className="font-medium text-muted-foreground">Logos / textes fournis :</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {d.elements.map((el, i) =>
              el.type === "logo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={el.src} alt="" className="h-14 w-14 rounded-md border border-border object-cover" />
              ) : (
                <span key={i} className="rounded-md border border-border bg-card px-2 py-1 text-card-foreground">
                  ✎ {el.content || "(texte vide)"}
                </span>
              )
            )}
          </div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        {d.couleurType && (
          <span>
            Couleurs : {COULEUR_TYPE_LABEL[d.couleurType] ?? d.couleurType}
            {d.couleurs?.length ? ` — ${d.couleurs.join(", ")}` : ""}
          </span>
        )}
        {d.livraisonMode && <span>Livraison : {LIVRAISON_LABEL[d.livraisonMode] ?? d.livraisonMode}</span>}
        {d.impressionVoulue && <span>Impression souhaitée</span>}
        {d.modelesChoisis?.length > 0 && <span>{d.modelesChoisis.length} modèle(s) de bibliothèque choisi(s)</span>}
      </div>
    </div>
  );
}

function formatFcfa(v: string | number) {
  return `${Math.round(Number(v)).toLocaleString("fr-FR")} FCFA`;
}

function formatRelatif(d: Date | string) {
  const date = new Date(d);
  const min = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

const POLL_MS = 10_000;
// L'alerte sonne en boucle (pas un simple bip isolé) pendant CYCLE_BOUCLE_MS, marque un silence de
// CYCLE_SILENCE_MS, puis recommence — volontairement insistant tant que rien n'est traité.
const CYCLE_BOUCLE_MS = 30_000;
const CYCLE_SILENCE_MS = 60_000;
const PAUSES = [1, 5, 15] as const;

// Plusieurs sonneries au choix — certaines nettement plus insistantes que le simple bip d'origine
// (l'utilisateur a signalé que celui-ci n'attirait pas assez l'attention).
const SONNERIES = {
  classique: { label: "Classique", notes: [{ freq: 880, dur: 0.25, gain: 0.16, delay: 0 }] },
  grave: {
    label: "Grave insistant",
    notes: [
      { freq: 320, dur: 0.18, gain: 0.22, delay: 0 },
      { freq: 320, dur: 0.18, gain: 0.22, delay: 0.26 },
    ],
  },
  aigu: {
    label: "Aigu urgent",
    notes: [
      { freq: 1500, dur: 0.09, gain: 0.18, delay: 0 },
      { freq: 1500, dur: 0.09, gain: 0.18, delay: 0.14 },
      { freq: 1500, dur: 0.09, gain: 0.18, delay: 0.28 },
    ],
  },
  sirene: {
    label: "Sirène",
    notes: [
      { freq: 700, dur: 0.3, gain: 0.2, delay: 0 },
      { freq: 1150, dur: 0.3, gain: 0.2, delay: 0.32 },
    ],
  },
  alterne: {
    label: "Grave/aigu alterné",
    notes: [
      { freq: 420, dur: 0.16, gain: 0.2, delay: 0 },
      { freq: 1300, dur: 0.16, gain: 0.2, delay: 0.2 },
      { freq: 420, dur: 0.16, gain: 0.2, delay: 0.4 },
      { freq: 1300, dur: 0.16, gain: 0.2, delay: 0.6 },
    ],
  },
} satisfies Record<string, { label: string; notes: { freq: number; dur: number; gain: number; delay: number }[] }>;

type SonnerieKey = keyof typeof SONNERIES;
const SONNERIE_DEFAUT: SonnerieKey = "classique";

function beep(sonnerie: SonnerieKey) {
  try {
    const ctx = new AudioContext();
    const config = SONNERIES[sonnerie] ?? SONNERIES[SONNERIE_DEFAUT];
    let finDerniereNote = 0;
    config.notes.forEach((note) => {
      const debut = note.delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = note.freq;
      gain.gain.value = note.gain;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + debut);
      osc.stop(ctx.currentTime + debut + note.dur);
      finDerniereNote = Math.max(finDerniereNote, debut + note.dur);
    });
    setTimeout(() => ctx.close(), (finDerniereNote + 0.1) * 1000);
  } catch {
    // AudioContext indisponible (ex. avant toute interaction utilisateur) — silencieux.
  }
}

function dureeSonnerie(sonnerie: SonnerieKey): number {
  const config = SONNERIES[sonnerie] ?? SONNERIES[SONNERIE_DEFAUT];
  return Math.max(...config.notes.map((n) => n.delay + n.dur));
}

type FluxRow =
  | { kind: "stock"; key: string; dateCreation: Date; data: Demande }
  | { kind: "proforma"; key: string; dateCreation: Date; data: Proforma }
  | { kind: "maquette"; key: string; dateCreation: Date; data: DemandeMaquette };

const KIND_LABEL: Record<FluxRow["kind"], { label: string; cls: string }> = {
  stock: { label: "Stock", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  proforma: { label: "Proforma", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
  maquette: { label: "Maquette", cls: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300" },
};

function KindBadge({ kind }: { kind: FluxRow["kind"] }) {
  const m = KIND_LABEL[kind];
  return <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${m.cls}`}>{m.label}</span>;
}

function rowTitre(row: FluxRow): string {
  if (row.kind === "stock") {
    const d = row.data;
    return d.articleNom + (d.taille || d.couleur ? ` (${[d.taille, d.couleur].filter(Boolean).join(" / ")})` : "");
  }
  return row.data.numero;
}

function rowSousTitre(row: FluxRow): string {
  if (row.kind === "stock") return `Affaire ${row.data.affaireNumero} · manque ${row.data.manque}`;
  if (row.kind === "proforma") return `${row.data.clientNom} — ${formatFcfa(row.data.montantTtc)}`;
  const d = row.data;
  return `${d.nomClient}${d.forfaitNom ? " — " + d.forfaitNom : ""}`;
}

type AvisRow = { id: number; nom: string; message: string; dateCreation: Date };
type MessageRow = { id: number; nom: string; contact: string | null; message: string; dateCreation: Date };

// File d'attente avis/messages du site (§ demande utilisateur 2026-08-12) — chargée à part (fetch
// client au montage) plutôt que via les props de page.tsx : évite de retoucher toute la chaîne de
// chargement serveur existante pour une file secondaire, même esprit que les autres files déjà là.
function AvisEtMessagesSection() {
  const [avis, setAvis] = useState<AvisRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [charge, setCharge] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    chargerAvisEtMessagesEnAttente().then((r) => {
      setAvis(r.avis);
      setMessages(r.messages);
      setCharge(true);
    });
  }, []);

  async function traiterAvis(id: number, decision: "APPROUVE" | "REJETE") {
    setBusy(`avis-${id}`);
    await traiterAvisSite(id, decision);
    setAvis((prev) => prev.filter((a) => a.id !== id));
    setBusy(null);
  }

  async function lireMessage(id: number) {
    setBusy(`msg-${id}`);
    await marquerMessageContactLu(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setBusy(null);
  }

  if (!charge || (avis.length === 0 && messages.length === 0)) return null;

  return (
    <section className="grid gap-3 sm:grid-cols-2">
      {avis.length > 0 && (
        <div className="rounded-md border border-border bg-card p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avis en attente ({avis.length})</div>
          <div className="flex flex-col gap-2">
            {avis.map((a) => (
              <div key={a.id} className="rounded border border-border p-2 text-sm">
                <div className="font-semibold text-foreground">{a.nom}</div>
                <p className="mt-0.5 text-muted-foreground">{a.message}</p>
                <div className="mt-1.5 flex gap-2">
                  <Button size="sm" disabled={busy === `avis-${a.id}`} onClick={() => traiterAvis(a.id, "APPROUVE")}>
                    Approuver
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === `avis-${a.id}`} onClick={() => traiterAvis(a.id, "REJETE")}>
                    Rejeter
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {messages.length > 0 && (
        <div className="rounded-md border border-border bg-card p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Messages reçus ({messages.length})</div>
          <div className="flex flex-col gap-2">
            {messages.map((m) => (
              <div key={m.id} className="rounded border border-border p-2 text-sm">
                <div className="font-semibold text-foreground">
                  {m.nom} {m.contact && <span className="font-normal text-muted-foreground">— {m.contact}</span>}
                </div>
                <p className="mt-0.5 text-muted-foreground">{m.message}</p>
                <Button size="sm" variant="outline" className="mt-1.5" disabled={busy === `msg-${m.id}`} onClick={() => lireMessage(m.id)}>
                  Marquer comme lu
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "warning" }) {
  const color = accent === "warning" ? "text-amber-500" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1.5 text-xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function DetailPanel({
  row,
  isPending,
  rechargeSaisie,
  setRechargeSaisie,
  traiter,
}: {
  row: FluxRow;
  isPending: boolean;
  rechargeSaisie: Record<number, string>;
  setRechargeSaisie: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  traiter: (action: () => Promise<{ error?: string }>) => void;
}) {
  if (row.kind === "stock") {
    const d = row.data;
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <div className="text-lg font-bold text-foreground">
              {d.articleNom}
              {d.taille || d.couleur ? ` (${[d.taille, d.couleur].filter(Boolean).join(" / ")})` : ""}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Affaire {d.affaireNumero} · canal {d.canal}
            </div>
          </div>
          <KindBadge kind="stock" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Demandé : <b className="text-foreground">{d.quantiteDemandee}</b> — Manque : <b className="text-foreground">{d.manque}</b>
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={isPending} onClick={() => traiter(() => autoriserDemande(d.id))}>
            Autoriser ({d.manque})
          </Button>
          <input
            type="number"
            min={d.manque}
            placeholder={`≥ ${d.manque}`}
            value={rechargeSaisie[d.id] ?? ""}
            onChange={(e) => setRechargeSaisie((prev) => ({ ...prev, [d.id]: e.target.value }))}
            className="w-24 rounded border border-input bg-background px-2 py-1 text-sm"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() => traiter(() => rechargerDemande(d.id, Number(rechargeSaisie[d.id] ?? d.manque)))}
          >
            Recharger
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => traiter(() => refuserDemande(d.id))}>
            Refuser
          </Button>
        </div>
      </div>
    );
  }

  if (row.kind === "proforma") {
    const p = row.data;
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <div className="text-lg font-bold text-foreground">{p.numero}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">par {p.auteurNom}</div>
          </div>
          <KindBadge kind="proforma" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {p.clientNom} — <b className="text-foreground">{formatFcfa(p.montantTtc)}</b>
        </p>
        <div className="mt-4 flex gap-2">
          <Button size="sm" disabled={isPending} onClick={() => traiter(() => validerProforma(p.id))}>
            Valider
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => traiter(() => refuserProforma(p.id))}>
            Refuser
          </Button>
        </div>
      </div>
    );
  }

  const d = row.data;
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="text-lg font-bold text-foreground">{d.numero}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {d.intent === "pagne" ? "Commander un pagne" : "Créer une maquette"}
          </div>
        </div>
        <KindBadge kind="maquette" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        {d.nomClient} — {d.telephoneClient}
        {d.forfaitNom && (
          <>
            {" — "}
            <b className="text-foreground">
              {d.forfaitNom} ({formatFcfa(d.forfaitPrix ?? 0)})
            </b>
          </>
        )}
      </p>
      <div className="mt-4 flex gap-2">
        <Button size="sm" disabled={isPending} onClick={() => traiter(() => validerDemandeMaquette(d.id))}>
          Valider (crée l&apos;affaire)
        </Button>
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => traiter(() => refuserDemandeMaquette(d.id))}>
          Refuser
        </Button>
      </div>
      <DemandeMaquetteDetail details={d.details} />
    </div>
  );
}

function HistoriqueRow({ row }: { row: FluxRow }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground">
      <div className="flex min-w-0 items-center gap-2">
        <KindBadge kind={row.kind} />
        <span className="truncate">
          {rowTitre(row)} — {rowSousTitre(row)}
        </span>
      </div>
      <span className="flex-shrink-0">{row.data.statut}</span>
    </div>
  );
}

export function ValidationsClient({
  userName,
  roleLibelle,
  modules,
  demandes: initial,
  proformas,
  demandesMaquette,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  demandes: Demande[];
  proformas: Proforma[];
  demandesMaquette: DemandeMaquette[];
}) {
  const router = useRouter();
  const [enAttente, setEnAttente] = useState<Demande[]>(
    initial.filter((d) => d.statut === "EN_ATTENTE")
  );
  const historiqueStock = initial.filter((d) => d.statut !== "EN_ATTENTE").slice(0, 30);
  const proformasEnAttente = proformas.filter((p) => p.statut === "EN_ATTENTE");
  const proformasHistorique = proformas.filter((p) => p.statut !== "EN_ATTENTE").slice(0, 30);
  const maquetteEnAttente = demandesMaquette.filter((d) => d.statut === "EN_ATTENTE");
  const maquetteHistorique = demandesMaquette.filter((d) => d.statut !== "EN_ATTENTE").slice(0, 30);

  const [onglet, setOnglet] = useState<"attente" | "historique">("attente");
  const [alerteActive, setAlerteActive] = useState(false);
  const [sonnerie, setSonnerie] = useState<SonnerieKey>(SONNERIE_DEFAUT);
  const [pauseJusqua, setPauseJusqua] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rechargeSaisie, setRechargeSaisie] = useState<Record<number, string>>({});
  const [isPending, startTransition] = useTransition();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("evolutis223_alerte_stock");
    if (stored === "1") setAlerteActive(true);
    const sonnerieStockee = window.localStorage.getItem("evolutis223_sonnerie_stock");
    if (sonnerieStockee && sonnerieStockee in SONNERIES) setSonnerie(sonnerieStockee as SonnerieKey);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("evolutis223_alerte_stock", alerteActive ? "1" : "0");
  }, [alerteActive]);

  useEffect(() => {
    window.localStorage.setItem("evolutis223_sonnerie_stock", sonnerie);
  }, [sonnerie]);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const fresh = await listerDemandesEnAttente();
        setEnAttente(fresh);
      } catch {
        // session expirée / accès refusé — la page se resynchronisera à la prochaine navigation
      }
    }, POLL_MS);
    return () => clearInterval(poll);
  }, []);

  const totalEnAttente = enAttente.length + proformasEnAttente.length + maquetteEnAttente.length;

  useEffect(() => {
    if (!alerteActive || totalEnAttente === 0) return;
    const enPause = pauseJusqua !== null && Date.now() < pauseJusqua;
    if (enPause) return;
    if (pauseJusqua !== null && Date.now() >= pauseJusqua) setPauseJusqua(null);

    let arretee = false;
    const pas = (dureeSonnerie(sonnerie) + 0.25) * 1000;
    const repetitionsParCycle = Math.max(1, Math.ceil(CYCLE_BOUCLE_MS / pas));

    function sonnerCycle() {
      for (let i = 0; i < repetitionsParCycle; i++) {
        setTimeout(() => {
          if (!arretee) beep(sonnerie);
        }, i * pas);
      }
    }

    sonnerCycle();
    const timer = setInterval(() => {
      if (pauseJusqua === null || Date.now() >= pauseJusqua) sonnerCycle();
    }, CYCLE_BOUCLE_MS + CYCLE_SILENCE_MS);

    return () => {
      arretee = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerteActive, totalEnAttente, pauseJusqua, sonnerie]);

  const refDemandes = useRef(enAttente);
  refDemandes.current = enAttente;

  async function refresh() {
    const fresh = await listerDemandesEnAttente();
    setEnAttente(fresh);
    router.refresh();
  }

  function traiter(action: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      setErreur(null);
      const res = await action();
      if (res.error) setErreur(res.error);
      await refresh();
    });
  }

  const fluxEnAttente: FluxRow[] = useMemo(() => {
    const rows: FluxRow[] = [
      ...enAttente.map((d) => ({ kind: "stock" as const, key: `stock-${d.id}`, dateCreation: d.dateCreation, data: d })),
      ...proformasEnAttente.map((p) => ({ kind: "proforma" as const, key: `proforma-${p.id}`, dateCreation: p.dateCreation, data: p })),
      ...maquetteEnAttente.map((d) => ({ kind: "maquette" as const, key: `maquette-${d.id}`, dateCreation: d.dateCreation, data: d })),
    ];
    return rows.sort((a, b) => new Date(a.dateCreation).getTime() - new Date(b.dateCreation).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enAttente, proformasEnAttente.length, maquetteEnAttente.length]);

  const fluxHistorique: FluxRow[] = useMemo(() => {
    const rows: FluxRow[] = [
      ...historiqueStock.map((d) => ({ kind: "stock" as const, key: `stock-${d.id}`, dateCreation: d.dateTraitement ?? d.dateCreation, data: d })),
      ...proformasHistorique.map((p) => ({ kind: "proforma" as const, key: `proforma-${p.id}`, dateCreation: p.dateCreation, data: p })),
      ...maquetteHistorique.map((d) => ({ kind: "maquette" as const, key: `maquette-${d.id}`, dateCreation: d.dateCreation, data: d })),
    ];
    return rows.sort((a, b) => new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime()).slice(0, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historiqueStock, proformasHistorique, maquetteHistorique]);

  const selected = fluxEnAttente.find((r) => r.key === selectedKey);

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Tour de contrôle — Validations" modules={modules}>
      <div className="flex h-full min-h-0 flex-col gap-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">Tour de contrôle</h1>
              <AideBulle titre="Comment utiliser Tour de contrôle">
                <p>
                  <b>Ce que tu vois ici</b> — toutes les décisions qui attendent Admin/Super Admin : ventes bloquées par manque de stock détail (§9), proformas à valider avant envoi (§12), et demandes de maquette venues du site public (§10ter).
                </p>
                <p>
                  <b>Stock — Autoriser / Recharger</b> — &quot;Autoriser&quot; transfère juste le manque depuis la réserve gros vers le détail. &quot;Recharger&quot; transfère une quantité plus grande, pour couvrir aussi les prochaines ventes sans redemander.
                </p>
                <p>
                  <b>Alerte sonore</b> — sonne en boucle pendant 30s, puis silence 1 min, et recommence tant qu&apos;il reste au moins une demande en attente (stock, proforma ou maquette). Volontairement insistante pour ne rien laisser traîner. Mets en pause si tu es en pleine saisie ailleurs.
                </p>
              </AideBulle>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Ventes bloquées, proformas et demandes maquette — tout ce qui attend une décision Admin/Super Admin, au même endroit.
            </p>
          </div>
          <a href="/" className="text-sm text-muted-foreground hover:underline">
            ← Tableau de bord
          </a>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total en attente" value={String(totalEnAttente)} accent={totalEnAttente > 0 ? "warning" : undefined} />
          <Stat label="Stock détail (§9)" value={String(enAttente.length)} />
          <Stat label="Proformas (§12)" value={String(proformasEnAttente.length)} />
          <Stat label="Maquettes (§10ter)" value={String(maquetteEnAttente.length)} />
        </div>

        <section className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={alerteActive}
              onChange={(e) => {
                setAlerteActive(e.target.checked);
                setPauseJusqua(null);
              }}
            />
            Alerte sonore (sonne en boucle 30s, silence 1 min, tant qu&apos;une demande attend)
          </label>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Sonnerie :</span>
            <select
              value={sonnerie}
              onChange={(e) => setSonnerie(e.target.value as SonnerieKey)}
              className="rounded border border-input bg-background px-2 py-1 text-sm text-foreground"
            >
              {(Object.keys(SONNERIES) as SonnerieKey[]).map((key) => (
                <option key={key} value={key}>
                  {SONNERIES[key].label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded border border-border px-2 py-0.5 hover:bg-muted"
              onClick={() => beep(sonnerie)}
            >
              Tester ▶
            </button>
          </div>
          {alerteActive && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Mettre en pause :</span>
              {PAUSES.map((min) => (
                <button
                  key={min}
                  type="button"
                  className="rounded border border-border px-2 py-0.5 hover:bg-muted"
                  onClick={() => setPauseJusqua(Date.now() + min * 60_000)}
                >
                  {min} min
                </button>
              ))}
              {pauseJusqua && pauseJusqua > Date.now() && (
                <span>(en pause jusqu&apos;à {new Date(pauseJusqua).toLocaleTimeString("fr-FR")})</span>
              )}
            </div>
          )}
        </section>

        <AvisEtMessagesSection />

        {erreur && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{erreur}</p>
        )}

        <div className="flex gap-1.5">
          <button
            onClick={() => setOnglet("attente")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${onglet === "attente" ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            En attente ({totalEnAttente})
          </button>
          <button
            onClick={() => setOnglet("historique")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${onglet === "historique" ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            Historique
          </button>
        </div>

        {onglet === "attente" ? (
          <div className="flex min-h-0 flex-1 gap-4">
            <div className="flex w-80 flex-shrink-0 flex-col gap-2 overflow-y-auto">
              {fluxEnAttente.length === 0 && (
                <p className="rounded-md border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  Aucune demande en attente. 🎉
                </p>
              )}
              {fluxEnAttente.map((row) => (
                <button
                  key={row.key}
                  onClick={() => setSelectedKey(row.key)}
                  className={`rounded-lg border p-3 text-left transition-colors ${row.key === selectedKey ? "border-primary bg-primary/10" : "border-border bg-card hover:border-border/70"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{rowTitre(row)}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{rowSousTitre(row)}</div>
                    </div>
                    <KindBadge kind={row.kind} />
                  </div>
                  <div className="mt-2 text-[10.5px] text-muted-foreground">{formatRelatif(row.dateCreation)}</div>
                </button>
              ))}
            </div>

            <div className="min-w-0 flex-1 overflow-y-auto rounded-xl border border-border bg-card p-6">
              {!selected ? (
                <p className="text-sm text-muted-foreground">Cliquez un élément à gauche pour voir sa fiche et décider.</p>
              ) : (
                <DetailPanel
                  row={selected}
                  isPending={isPending}
                  rechargeSaisie={rechargeSaisie}
                  setRechargeSaisie={setRechargeSaisie}
                  traiter={traiter}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-1 overflow-y-auto">
            {fluxHistorique.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun historique pour le moment.</p>
            ) : (
              fluxHistorique.map((row) => <HistoriqueRow key={row.key} row={row} />)
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
