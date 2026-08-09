"use client";

import { useState, useTransition } from "react";
import { AppShell, type ShellModule } from "@/components/app-shell";
import { chargerDetailComplet, type Frequence, type RapportDetailComplet } from "../actions";

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const FREQUENCES: { value: Frequence; label: string }[] = [
  { value: "JOUR", label: "Jour" },
  { value: "SEMAINE", label: "Semaine" },
  { value: "MOIS", label: "Mois" },
  { value: "SEMESTRE", label: "Semestre" },
  { value: "ANNEE", label: "Année" },
];

const LIVRAISON_STATUT_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  PRIS_EN_CHARGE: "Pris en charge",
  EN_ROUTE: "En route",
  LIVREE: "Livrée",
  ECHEC: "Échec",
};
const INCIDENT_TYPE_LABELS: Record<string, string> = {
  MALADIE: "Maladie",
  BLESSURE: "Blessure",
  DECES: "Décès",
  CATASTROPHE_NATURELLE: "Catastrophe naturelle",
  BLOCAGE_RECRUTEMENT: "Blocage de recrutement",
  AUTRE: "Autre",
};

function Section({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-foreground">{titre}</h2>
        {sousTitre && <span className="text-xs text-muted-foreground">{sousTitre}</span>}
      </div>
      {children}
    </div>
  );
}

export function RapportDetailClient({
  userName,
  roleLibelle,
  modules,
  initialDetail,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  initialDetail: RapportDetailComplet;
}) {
  const [frequence, setFrequence] = useState<Frequence>("MOIS");
  const [detail, setDetail] = useState(initialDetail);
  const [pending, startTransition] = useTransition();

  function choisir(f: Frequence) {
    setFrequence(f);
    startTransition(async () => setDetail(await chargerDetailComplet(f)));
  }

  const totalVentes = detail.ventes.reduce((s, v) => s + v.montantTtc, 0);
  const totalDecaissements = detail.decaissements.reduce((s, d) => s + d.montant, 0);

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Rapport détaillé" modules={modules}>
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Rapport détaillé — {detail.periodeLabel}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Toutes les activités, ligne par ligne.</p>
          </div>
          <a href="/rapports" className="text-sm text-muted-foreground hover:underline">
            ← Rapports
          </a>
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

        <div className={`space-y-4 ${pending ? "opacity-50 transition-opacity" : "transition-opacity"}`}>
          <Section titre="Ventes" sousTitre={`${detail.ventes.length} — total ${fmt(totalVentes)}`}>
            {detail.ventes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vente sur la période.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="py-1.5 pr-3">N°</th>
                      <th className="py-1.5 pr-3">Client</th>
                      <th className="py-1.5 pr-3">Statut</th>
                      <th className="py-1.5 pr-3">Date</th>
                      <th className="py-1.5 text-right">Montant TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.ventes.map((v) => (
                      <tr key={v.numero} className="border-b border-border/60">
                        <td className="py-1.5 pr-3 font-mono text-xs">{v.numero}</td>
                        <td className="py-1.5 pr-3">{v.clientNom}</td>
                        <td className="py-1.5 pr-3 text-xs text-muted-foreground">{v.statut}</td>
                        <td className="py-1.5 pr-3 text-xs text-muted-foreground">{fmtDate(v.dateCreation)}</td>
                        <td className="py-1.5 text-right tabular-nums">{fmt(v.montantTtc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section titre="Décaissements validés" sousTitre={`${detail.decaissements.length} — total ${fmt(totalDecaissements)}`}>
            {detail.decaissements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun décaissement validé sur la période.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="py-1.5 pr-3">Motif</th>
                      <th className="py-1.5 pr-3">Catégorie</th>
                      <th className="py-1.5 pr-3">Auteur</th>
                      <th className="py-1.5 pr-3">Date</th>
                      <th className="py-1.5 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.decaissements.map((d, i) => (
                      <tr key={i} className="border-b border-border/60">
                        <td className="py-1.5 pr-3">{d.motif}</td>
                        <td className="py-1.5 pr-3 text-xs text-muted-foreground">{d.categorie}</td>
                        <td className="py-1.5 pr-3 text-xs text-muted-foreground">{d.auteurNom}</td>
                        <td className="py-1.5 pr-3 text-xs text-muted-foreground">{fmtDate(d.dateCreation)}</td>
                        <td className="py-1.5 text-right tabular-nums">{fmt(d.montant)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section titre="Livraisons" sousTitre={`${detail.livraisons.length}`}>
            {detail.livraisons.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune livraison sur la période.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {detail.livraisons.map((l) => (
                  <div key={l.numero} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-1.5 text-sm">
                    <span className="font-mono text-xs">{l.numero}</span>
                    <span className="text-muted-foreground">Affaire {l.affaireNumero}</span>
                    <span className="text-xs font-semibold">{LIVRAISON_STATUT_LABELS[l.statut] ?? l.statut}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(l.dateCreation)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section titre="Ruptures de stock (actuel)" sousTitre={`${detail.ruptures.length}`}>
            {detail.ruptures.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune rupture actuellement.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {detail.ruptures.map((r, i) => (
                  <span key={i} className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                    {r.articleNom}
                    {r.taille || r.couleur ? ` (${[r.taille, r.couleur].filter(Boolean).join(" / ")})` : ""}
                  </span>
                ))}
              </div>
            )}
          </Section>

          <Section titre="Incidents personnel" sousTitre={`${detail.incidents.length}`}>
            {detail.incidents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun incident sur la période.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {detail.incidents.map((inc, i) => (
                  <div key={i} className="rounded-md border border-border/60 px-3 py-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{INCIDENT_TYPE_LABELS[inc.type] ?? inc.type}</span>
                      <span className="text-xs text-muted-foreground">{inc.personnelNom} · {fmtDate(inc.dateIncident)}</span>
                    </div>
                    {inc.description && <p className="mt-0.5 text-xs text-muted-foreground">{inc.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section titre="Besoins de personnel actifs" sousTitre={`${detail.besoinsActifs.length}`}>
            {detail.besoinsActifs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun besoin actif sur la période.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {detail.besoinsActifs.map((b, i) => (
                  <div key={i} className="rounded-md border border-border/60 px-3 py-1.5 text-sm">
                    <div className="font-semibold">{b.titre}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.fonction ? `${b.fonction} · ` : ""}
                      {b.nombrePersonnesRequis} pers. · {b.periodeDebut} → {b.periodeFin} · {b.statut}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </AppShell>
  );
}
