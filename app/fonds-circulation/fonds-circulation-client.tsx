"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell, type ShellModule } from "@/components/app-shell";
import { validerRemise } from "./actions";

interface FondsRow {
  id: number;
  livreurNom: string;
  affaireNumero: string;
  montantAttendu: string;
  montantRemis: string | null;
  statut: string;
  dateRemise: Date | null;
}

function formatFcfa(v: string | number) {
  return `${Math.round(Number(v)).toLocaleString("fr-FR")} F`;
}

export function FondsCirculationClient({
  userName,
  roleLibelle,
  modules,
  fonds: initial,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  fonds: FondsRow[];
}) {
  const router = useRouter();
  const [saisie, setSaisie] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const enCirculation = initial.filter((f) => f.statut === "EN_CIRCULATION");
  const historique = initial.filter((f) => f.statut !== "EN_CIRCULATION").slice(0, 30);

  async function valider(f: FondsRow) {
    const montant = Number(saisie[f.id] ?? f.montantAttendu);
    setBusy(f.id);
    setErreur(null);
    const res = await validerRemise(f.id, montant);
    setBusy(null);
    if (res.error) setErreur(res.error);
    router.refresh();
  }

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Fonds en circulation" modules={modules}>
    <div className="mx-auto max-w-3xl p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Fonds en circulation (§8.2)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Espèces collectées sur le terrain par un livreur — rapprochement et validation
            Admin/Comptable avant impact sur la Trésorerie centrale.
          </p>
        </div>
        <a href="/" className="text-sm text-muted-foreground hover:underline">
          ← Tableau de bord
        </a>
      </header>

      {erreur && (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
          {erreur}
        </p>
      )}

      <section className="mt-5 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          En circulation ({enCirculation.length})
        </h2>
        {enCirculation.length === 0 ? (
          <p className="text-sm text-muted-foreground">Rien en attente de remise.</p>
        ) : (
          enCirculation.map((f) => (
            <div key={f.id} className="rounded-md border border-border bg-card p-3 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-card-foreground">{f.livreurNom}</span>
                <span className="text-xs text-muted-foreground">Affaire {f.affaireNumero}</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                Attendu : <strong>{formatFcfa(f.montantAttendu)}</strong>
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  placeholder={f.montantAttendu}
                  value={saisie[f.id] ?? ""}
                  onChange={(e) => setSaisie((prev) => ({ ...prev, [f.id]: e.target.value }))}
                  className="h-9 w-40"
                />
                <Button size="sm" disabled={busy === f.id} onClick={() => valider(f)}>
                  Valider la remise
                </Button>
              </div>
            </div>
          ))
        )}
      </section>

      {historique.length > 0 && (
        <section className="mt-6 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Historique récent</h2>
          <div className="space-y-1">
            {historique.map((f) => {
              const ecart = Number(f.montantRemis ?? 0) - Number(f.montantAttendu);
              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground"
                >
                  <span>
                    {f.livreurNom} — Affaire {f.affaireNumero} — remis {formatFcfa(f.montantRemis ?? 0)}
                  </span>
                  <span className={ecart !== 0 ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
                    {ecart !== 0 ? `écart ${ecart > 0 ? "+" : ""}${formatFcfa(ecart)}` : "OK"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
    </AppShell>
  );
}
