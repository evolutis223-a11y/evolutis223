"use client";

import { useState, useTransition } from "react";
import { AppShell, type ShellModule } from "@/components/app-shell";
import { chargerRapportFinance, chargerRapportRh, type Frequence, type RapportFinance, type RapportRh } from "./actions";

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} F`;
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

export function RapportsClient({
  userName,
  roleLibelle,
  modules,
  initialFinance,
  initialRh,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  initialFinance: RapportFinance;
  initialRh: RapportRh;
}) {
  const [dimension, setDimension] = useState<"finance" | "rh" | "incidents" | "previsions">("finance");
  const [frequence, setFrequence] = useState<Frequence>("MOIS");
  const [finance, setFinance] = useState(initialFinance);
  const [rh, setRh] = useState(initialRh);
  const [pending, startTransition] = useTransition();

  function choisir(f: Frequence) {
    setFrequence(f);
    startTransition(async () => {
      const [fin, r] = await Promise.all([chargerRapportFinance(f), chargerRapportRh(f)]);
      setFinance(fin);
      setRh(r);
    });
  }

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Rapports" modules={modules}>
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold text-foreground">Rapports (§7)</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Toujours recalculé depuis les données réelles — jamais saisi à la main.
      </p>

      <div className="mt-4 flex gap-1.5 border-b border-border">
        {(["finance", "rh", "incidents", "previsions"] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDimension(d)}
            className={`rounded-t-md border border-b-0 px-4 py-2 text-sm font-semibold ${dimension === d ? "border-border bg-muted text-foreground" : "border-transparent text-muted-foreground"}`}
          >
            {d === "finance" ? "Finance" : d === "rh" ? "RH" : d === "incidents" ? "Incidents" : "Prévisions"}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-1.5">
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

      <div className={`mt-4 rounded-md border border-border bg-card p-5 ${pending ? "opacity-50" : ""}`}>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{finance.periodeLabel}</div>

        {dimension === "finance" && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="Chiffre d'affaires" value={fmt(finance.chiffreAffaires)} />
              <Stat label="Ventes réalisées" value={String(finance.nombreVentes)} />
              <Stat label="Coût d'achat des ventes" value={fmt(finance.coutAchatVentes)} />
              <Stat label="Bénéfice brut" value={fmt(finance.beneficeBrut)} highlight />
              <Stat label="Dépenses / charges" value={fmt(finance.depensesCharges)} />
              <Stat label="Commissions payées" value={fmt(finance.commissions)} />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <span className="text-sm text-muted-foreground">Bénéfice net</span>
              <span className={`text-2xl font-bold ${finance.beneficeNet >= 0 ? "text-foreground" : "text-destructive"}`}>
                {fmt(finance.beneficeNet)}
              </span>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Coût d&apos;achat calculé au PMP courant de chaque article — pas un historique figé au moment de la vente.
            </p>
          </>
        )}

        {dimension === "rh" && (
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Effectif actif" value={String(rh.effectifActif)} />
            <Stat label="Masse salariale payée" value={fmt(rh.masseSalariale)} highlight />
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
      </div>
    </div>
    </AppShell>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
