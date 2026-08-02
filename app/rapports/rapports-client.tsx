"use client";

import { useState, useTransition } from "react";
import { chargerRapportFinance, type Frequence, type RapportFinance } from "./actions";

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

export function RapportsClient({ initial }: { initial: RapportFinance }) {
  const [frequence, setFrequence] = useState<Frequence>("MOIS");
  const [rapport, setRapport] = useState(initial);
  const [pending, startTransition] = useTransition();

  function choisir(f: Frequence) {
    setFrequence(f);
    startTransition(async () => {
      const r = await chargerRapportFinance(f);
      setRapport(r);
    });
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold text-foreground">Rapports (§7) — Finance</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Toujours recalculé depuis les affaires, décaissements et bulletins de paie réels — jamais saisi à la main.
      </p>

      <div className="mt-5 flex gap-1.5">
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
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{rapport.periodeLabel}</div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Chiffre d'affaires" value={fmt(rapport.chiffreAffaires)} />
          <Stat label="Ventes réalisées" value={String(rapport.nombreVentes)} />
          <Stat label="Coût d'achat des ventes" value={fmt(rapport.coutAchatVentes)} />
          <Stat label="Bénéfice brut" value={fmt(rapport.beneficeBrut)} highlight />
          <Stat label="Dépenses / charges" value={fmt(rapport.depensesCharges)} />
          <Stat label="Commissions payées" value={fmt(rapport.commissions)} />
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Bénéfice net</span>
          <span className={`text-2xl font-bold ${rapport.beneficeNet >= 0 ? "text-foreground" : "text-destructive"}`}>
            {fmt(rapport.beneficeNet)}
          </span>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Coût d&apos;achat calculé au PMP courant de chaque article — pas un historique figé au moment de la vente (le schéma
        n&apos;en conserve pas). Dimensions RH, Incidents et Prévisions pas encore définies dans le cahier des charges — non
        construites pour l&apos;instant.
      </p>
    </main>
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
