"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { affaires, livraisons } from "@/db/schema";
import { avancerLivraison } from "./actions";
import { marquerRetiree } from "../affaires/actions";

type AffaireRow = {
  id: number;
  numero: string;
  statut: string;
  modeFinalisation: string | null;
  montantTtc: string;
  clientNom: string;
};
type Livraison = typeof livraisons.$inferSelect;

function formatFcfa(v: string | number) {
  return `${Math.round(Number(v)).toLocaleString("fr-FR")} F`;
}

const LIVRAISON_LABEL: Record<string, string> = {
  EN_ATTENTE: "En attente",
  PRIS_EN_CHARGE: "Pris en charge",
  EN_ROUTE: "En route",
  LIVREE: "Livrée",
  ECHEC: "Échec",
};

const AFFAIRE_STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE: "En attente",
  EN_COURS: "En cours",
  VALIDEE: "Prête",
  CLOTUREE: "Clôturée",
  ANNULEE: "Annulée",
};

export function CommandesClient({
  affaires,
  livraisons,
}: {
  affaires: AffaireRow[];
  livraisons: Livraison[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const livraisonByAffaire = new Map(livraisons.map((l) => [l.affaireId, l]));

  async function handleRetrait(affaireId: number) {
    setBusy(affaireId);
    const res = await marquerRetiree(affaireId);
    setBusy(null);
    if (res.error) setMsg(res.error);
    router.refresh();
  }

  async function handleLivraison(livraisonId: number, next: "PRIS_EN_CHARGE" | "EN_ROUTE" | "LIVREE" | "ECHEC") {
    setBusy(livraisonId);
    const res = await avancerLivraison(livraisonId, next);
    setBusy(null);
    if (res.error) setMsg(res.error);
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold text-foreground">Commandes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ombrelle sur les Affaires avec mode de finalisation (§8.1) — Retrait en boutique ou Livraison.
      </p>

      {msg && <p className="mt-3 text-sm text-destructive">{msg}</p>}

      <div className="mt-5 space-y-2">
        {affaires.length === 0 && (
          <p className="rounded-md border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Aucune commande (retrait/livraison) pour l&apos;instant.
          </p>
        )}
        {affaires.map((a) => {
          const livraison = livraisonByAffaire.get(a.id);
          return (
            <div key={a.id} className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
              <div>
                <div className="font-mono text-sm font-medium text-foreground">{a.numero}</div>
                <div className="text-xs text-muted-foreground">{a.clientNom}</div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                  {a.modeFinalisation === "RETRAIT" ? "Retrait boutique" : "Livraison"}
                </span>
                <span className="text-xs text-muted-foreground">{AFFAIRE_STATUT_LABEL[a.statut]}</span>
                <span className="font-semibold tabular-nums text-foreground">{formatFcfa(a.montantTtc)}</span>

                {a.modeFinalisation === "RETRAIT" && a.statut === "VALIDEE" && (
                  <Button size="sm" disabled={busy === a.id} onClick={() => handleRetrait(a.id)}>
                    Marquer retirée
                  </Button>
                )}

                {a.modeFinalisation === "LIVRAISON" && livraison && (
                  <>
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      {LIVRAISON_LABEL[livraison.statut]}
                    </span>
                    {livraison.statut === "EN_ATTENTE" && (
                      <Button size="sm" disabled={busy === livraison.id} onClick={() => handleLivraison(livraison.id, "PRIS_EN_CHARGE")}>
                        Prendre en charge
                      </Button>
                    )}
                    {livraison.statut === "PRIS_EN_CHARGE" && (
                      <Button size="sm" disabled={busy === livraison.id} onClick={() => handleLivraison(livraison.id, "EN_ROUTE")}>
                        Mettre en route
                      </Button>
                    )}
                    {livraison.statut === "EN_ROUTE" && (
                      <Button size="sm" disabled={busy === livraison.id} onClick={() => handleLivraison(livraison.id, "LIVREE")}>
                        Marquer livrée
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
