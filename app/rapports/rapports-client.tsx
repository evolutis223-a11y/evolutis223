"use client";

import { useState, useTransition } from "react";
import { AppShell, type ShellModule } from "@/components/app-shell";
import { AideBulle } from "@/components/ui/aide-bulle";
import {
  chargerRapportFinance,
  chargerRapportOperations,
  chargerRapportRh,
  chargerTendanceFinance,
  type Frequence,
  type PointTendanceFinance,
  type RapportFinance,
  type RapportOperations,
  type RapportRh,
} from "./actions";

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

const FREQUENCES: { value: Frequence; label: string }[] = [
  { value: "JOUR", label: "Jour" },
  { value: "SEMAINE", label: "Semaine" },
  { value: "MOIS", label: "Mois" },
  { value: "SEMESTRE", label: "Semestre" },
  { value: "ANNEE", label: "Année" },
];

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  MALADIE: "Maladie",
  BLESSURE: "Blessure",
  DECES: "Décès",
  CATASTROPHE_NATURELLE: "Catastrophe naturelle",
  BLOCAGE_RECRUTEMENT: "Blocage de recrutement",
  AUTRE: "Autre",
};

const LIVRAISON_STATUT_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  PRIS_EN_CHARGE: "Pris en charge",
  EN_ROUTE: "En route",
  LIVREE: "Livrée",
  ECHEC: "Échec",
};

function Variation({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[11px] text-muted-foreground">— vs période préc.</span>;
  const positif = pct >= 0;
  return (
    <span className={`text-[11px] font-semibold tabular-nums ${positif ? "text-emerald-500" : "text-destructive"}`}>
      {positif ? "▲" : "▼"} {Math.abs(pct).toLocaleString("fr-FR")}% vs période préc.
    </span>
  );
}

// Petit graphique en barres appairées (CA / Bénéfice net) fait maison en SVG — pas de nouvelle
// dépendance de charting pour un simple comparatif visuel sur quelques points.
function TendanceChart({ points }: { points: PointTendanceFinance[] }) {
  if (points.length === 0) return null;
  const groupW = 50;
  const w = points.length * groupW;
  const h = 110;
  const max = Math.max(1, ...points.map((p) => Math.max(p.chiffreAffaires, p.beneficeNet)));
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full" preserveAspectRatio="none">
        {points.map((p, i) => {
          const x = i * groupW;
          const hCa = (p.chiffreAffaires / max) * 90;
          const hBn = (Math.max(0, p.beneficeNet) / max) * 90;
          return (
            <g key={i}>
              <rect x={x + 8} y={100 - hCa} width={14} height={hCa} rx={1.5} className="fill-primary/70" />
              <rect x={x + 26} y={100 - hBn} width={14} height={hBn} rx={1.5} className="fill-emerald-500" />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex text-center text-[10px] text-muted-foreground">
        {points.map((p, i) => (
          <div key={i} style={{ width: `${100 / points.length}%` }} className="truncate">
            {p.label}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-primary/70" /> Chiffre d&apos;affaires
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Bénéfice net
        </span>
      </div>
    </div>
  );
}

export function RapportsClient({
  userName,
  roleLibelle,
  modules,
  initialFinance,
  initialRh,
  initialOperations,
  initialTendance,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  initialFinance: RapportFinance;
  initialRh: RapportRh;
  initialOperations: RapportOperations;
  initialTendance: PointTendanceFinance[];
}) {
  const [dimension, setDimension] = useState<"finance" | "rh" | "incidents" | "previsions" | "operations">("finance");
  const [frequence, setFrequence] = useState<Frequence>("MOIS");
  const [finance, setFinance] = useState(initialFinance);
  const [rh, setRh] = useState(initialRh);
  const [operations, setOperations] = useState(initialOperations);
  const [tendance, setTendance] = useState(initialTendance);
  const [pending, startTransition] = useTransition();

  function choisir(f: Frequence) {
    setFrequence(f);
    startTransition(async () => {
      const [fin, r, ops, tend] = await Promise.all([
        chargerRapportFinance(f),
        chargerRapportRh(f),
        chargerRapportOperations(f),
        chargerTendanceFinance(f),
      ]);
      setFinance(fin);
      setRh(r);
      setOperations(ops);
      setTendance(tend);
    });
  }

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Rapports" modules={modules}>
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">Rapports</h1>
              <AideBulle titre="Comment utiliser Rapports">
                <p>
                  <b>Toujours recalculé</b> — rien n&apos;est saisi à la main ici, tout vient des données réelles de
                  l&apos;application (affaires, décaissements, personnel, livraisons, stock).
                </p>
                <p>
                  <b>Comparatif</b> — chaque chiffre-clé est comparé à la période précédente équivalente (ce mois vs le mois
                  dernier, cette semaine vs la semaine dernière...).
                </p>
                <p>
                  <b>Rapport détaillé</b> — vue exhaustive jour/semaine/mois/année de tout ce qui est suivi.
                  <b> Archive</b> — génère un document PDF officiel (en-tête, mentions légales) pour un mois donné,
                  utilisable pour une banque ou un partenaire.
                </p>
              </AideBulle>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Toujours recalculé depuis les données réelles — jamais saisi à la main.</p>
          </div>
          <div className="flex gap-2">
            <a
              href="/rapports/detail"
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              Rapport détaillé →
            </a>
            <a
              href="/rapports/archive"
              className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"
            >
              📁 Archive des rapports
            </a>
          </div>
        </div>

        <div className="flex gap-1.5">
          {FREQUENCES.map((f) => (
            <button
              key={f.value}
              onClick={() => choisir(f.value)}
              className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${frequence === f.value ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className={pending ? "opacity-50 transition-opacity" : "transition-opacity"}>
          <div className="rounded-xl border border-primary/30 bg-gradient-to-b from-primary/5 to-transparent p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="text-sm font-semibold text-foreground">{finance.periodeLabel}</span>
              <span className="ml-auto text-[11px] text-muted-foreground">{finance.nombreVentes} vente(s)</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-card/60 p-4">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Chiffre d&apos;affaires</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">{fmt(finance.chiffreAffaires)}</div>
                <div className="mt-1">
                  <Variation pct={finance.variationCaPct} />
                </div>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-card/60 p-4">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Bénéfice brut</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-500">{fmt(finance.beneficeBrut)}</div>
              </div>
              <div className="rounded-lg border border-primary/30 bg-card/60 p-4">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Bénéfice net</div>
                <div className={`mt-1 text-2xl font-bold tabular-nums ${finance.beneficeNet >= 0 ? "text-primary" : "text-destructive"}`}>
                  {fmt(finance.beneficeNet)}
                </div>
                <div className="mt-1">
                  <Variation pct={finance.variationBeneficeNetPct} />
                </div>
              </div>
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tendance</div>
              <TendanceChart points={tendance} />
            </div>
          </div>

          <div className="mt-4 flex gap-1.5 border-b border-border">
            {(["finance", "rh", "incidents", "previsions", "operations"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDimension(d)}
                className={`rounded-t-md border border-b-0 px-4 py-2 text-sm font-semibold ${dimension === d ? "border-border bg-muted text-foreground" : "border-transparent text-muted-foreground"}`}
              >
                {d === "finance" ? "Finance" : d === "rh" ? "RH" : d === "incidents" ? "Incidents" : d === "previsions" ? "Prévisions" : "Opérations"}
              </button>
            ))}
          </div>

          <div className="rounded-b-md rounded-tr-md border border-border bg-card p-5">
            {dimension === "finance" && (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Stat label="Coût d'achat des ventes" value={fmt(finance.coutAchatVentes)} />
                  <Stat label="Dépenses / charges" value={fmt(finance.depensesCharges)} />
                  <Stat label="Commissions payées" value={fmt(finance.commissions)} />
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Coût d&apos;achat calculé au PMP courant de chaque article — pas un historique figé au moment de la vente.
                </p>
              </>
            )}

            {dimension === "rh" && (
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Effectif actif" value={String(rh.effectifActif)} />
                <div>
                  <div className="text-xs text-muted-foreground">Masse salariale payée</div>
                  <div className="text-lg font-bold text-primary">{fmt(rh.masseSalariale)}</div>
                  <div className="mt-0.5">
                    <Variation pct={rh.variationMassePct} />
                  </div>
                </div>
              </div>
            )}

            {dimension === "incidents" && (
              <div>
                {rh.incidents.length === 0 && <p className="text-sm text-muted-foreground">Aucun incident sur la période.</p>}
                <div className="flex flex-col gap-2">
                  {rh.incidents.map((i) => (
                    <div key={i.type} className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-2.5">
                      <span className="text-sm text-foreground">{INCIDENT_TYPE_LABELS[i.type] ?? i.type}</span>
                      <span className="text-sm font-bold text-foreground">{i.nombre}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Événements humains touchant le personnel (§7 RH, onglet Incidents) — pas un indicateur financier.
                </p>
              </div>
            )}

            {dimension === "previsions" && (
              <div>
                {rh.besoinsActifs.length === 0 && <p className="text-sm text-muted-foreground">Aucun besoin de personnel actif sur la période.</p>}
                <div className="flex flex-col gap-2">
                  {rh.besoinsActifs.map((b, i) => (
                    <div key={i} className="rounded-md border border-border bg-muted/30 p-2.5">
                      <div className="text-sm font-semibold text-foreground">{b.titre}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.fonction ? `${b.fonction} · ` : ""}
                        {b.nombrePersonnesRequis} pers. · {b.periodeDebut} → {b.periodeFin} · {b.statut}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Planification RH des besoins de personnel à venir (§7 RH, onglet Prévisions) — pas une prévision de chiffre
                  d&apos;affaires.
                </p>
              </div>
            )}

            {dimension === "operations" && (
              <div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Stat label="Livraisons (période)" value={String(operations.totalLivraisons)} />
                  <Stat label="En rupture (actuel)" value={String(operations.ruptureActuelle)} accent={operations.ruptureActuelle > 0 ? "danger" : undefined} />
                  <Stat label="Stock faible (actuel)" value={String(operations.stockFaibleActuel)} accent={operations.stockFaibleActuel > 0 ? "warning" : undefined} />
                </div>
                {operations.livraisonsParStatut.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2">
                    {operations.livraisonsParStatut.map((l) => (
                      <div key={l.statut} className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-2.5">
                        <span className="text-sm text-foreground">{LIVRAISON_STATUT_LABELS[l.statut] ?? l.statut}</span>
                        <span className="text-sm font-bold text-foreground">{l.nombre}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Livraisons comptées à leur création sur la période. Rupture/stock faible : état actuel du stock, pas un
                  historique sur la période.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "warning" | "danger" }) {
  const color = accent === "warning" ? "text-amber-500" : accent === "danger" ? "text-rose-500" : "text-foreground";
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}
