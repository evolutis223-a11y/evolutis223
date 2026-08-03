"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell, type ShellModule } from "@/components/app-shell";
import type { affaires, livraisons } from "@/db/schema";
import { assignerLivreur, avancerLivraison } from "./actions";
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
type Livreur = { id: number; nom: string; roleCode: string };

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
  userName,
  roleLibelle,
  modules,
  affaires,
  livraisons,
  livreurs,
  soldeParAffaire,
  mesFondsEnCirculation,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  affaires: AffaireRow[];
  livraisons: Livraison[];
  livreurs: Livreur[];
  soldeParAffaire: Record<number, number>;
  mesFondsEnCirculation: { affaireNumero: string; montantAttendu: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [montantCollecte, setMontantCollecte] = useState<Record<number, string>>({});

  const livraisonByAffaire = new Map(livraisons.map((l) => [l.affaireId, l]));

  async function handleRetrait(affaireId: number) {
    setBusy(affaireId);
    const res = await marquerRetiree(affaireId);
    setBusy(null);
    if (res.error) setMsg(res.error);
    router.refresh();
  }

  async function handleLivraison(
    livraisonId: number,
    next: "PRIS_EN_CHARGE" | "EN_ROUTE" | "LIVREE" | "ECHEC",
    montantEspeces?: number
  ) {
    setBusy(livraisonId);
    const res = await avancerLivraison(livraisonId, next, montantEspeces);
    setBusy(null);
    if (res.error) setMsg(res.error);
    router.refresh();
  }

  async function handleAssignerLivreur(livraisonId: number, livreurId: number) {
    setBusy(livraisonId);
    const res = await assignerLivreur(livraisonId, livreurId);
    setBusy(null);
    if (res.error) setMsg(res.error);
    router.refresh();
  }

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Commandes" modules={modules}>
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold text-foreground">Commandes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ombrelle sur les Affaires avec mode de finalisation (§8.1) — Retrait en boutique ou Livraison.
      </p>

      {mesFondsEnCirculation.length > 0 && (
        <div className="mt-4 rounded-md border-l-2 border-amber-500 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <b>Mes fonds en circulation (§8.2)</b> — encaissé sur le terrain, pas encore remis à la
          Trésorerie :
          <ul className="mt-1 list-disc pl-5">
            {mesFondsEnCirculation.map((f, i) => (
              <li key={i}>
                {f.affaireNumero} — {formatFcfa(f.montantAttendu)}
              </li>
            ))}
          </ul>
        </div>
      )}

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

                <a
                  href={`/api/documents/bon-livraison/${a.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Bon de livraison
                </a>

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

                    {livraison.statut !== "LIVREE" && livraison.statut !== "ECHEC" && (
                      <select
                        value={livraison.livreurId ?? ""}
                        onChange={(e) => handleAssignerLivreur(livraison.id, Number(e.target.value))}
                        disabled={busy === livraison.id}
                        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                      >
                        <option value="">Livreur...</option>
                        {livreurs.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.nom}
                          </option>
                        ))}
                      </select>
                    )}

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
                    {livraison.statut === "EN_ROUTE" && (() => {
                      const solde = Number(a.montantTtc) - (soldeParAffaire[a.id] ?? 0);
                      return (
                        <>
                          {solde > 0 && (
                            <Input
                              type="number"
                              min="0"
                              placeholder={`Espèces reçues (solde ${formatFcfa(solde)})`}
                              value={montantCollecte[livraison.id] ?? ""}
                              onChange={(e) =>
                                setMontantCollecte((prev) => ({ ...prev, [livraison.id]: e.target.value }))
                              }
                              className="h-8 w-40 text-xs"
                            />
                          )}
                          <Button
                            size="sm"
                            disabled={busy === livraison.id}
                            onClick={() =>
                              handleLivraison(
                                livraison.id,
                                "LIVREE",
                                solde > 0 ? Number(montantCollecte[livraison.id] ?? 0) : undefined
                              )
                            }
                          >
                            Marquer livrée
                          </Button>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </AppShell>
  );
}
