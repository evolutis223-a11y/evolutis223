"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell, type ShellModule } from "@/components/app-shell";
import type { livraisons as livraisonsTable } from "@/db/schema";
import { assignerLivreur, avancerLivraison } from "./actions";
import { marquerRetiree } from "../affaires/actions";

type AffaireRow = {
  id: number;
  numero: string;
  statut: string;
  modeFinalisation: string | null;
  montantTtc: string;
  dateCreation: Date;
  objet: string | null;
  clientNom: string;
  clientContact: string | null;
};
type Livraison = typeof livraisonsTable.$inferSelect;
type Livreur = { id: number; nom: string; roleCode: string };

function formatFcfa(v: string | number) {
  return `${Math.round(Number(v)).toLocaleString("fr-FR")} FCFA`;
}
function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("fr-FR");
}

// Étape dérivée à partir de l'état réel (affaires.statut + livraisons.statut) — pas un champ
// séparé à synchroniser : impossible de désynchroniser l'affichage Kanban/Liste/Fiche entre eux.
type Stage = "NOUVELLE" | "PRETE" | "PRIS_EN_CHARGE" | "EN_ROUTE" | "CLOTUREE" | "ECHEC";

const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: "NOUVELLE", label: "Nouvelle", color: "#f59e0b" },
  { key: "PRETE", label: "Prête", color: "#3b82f6" },
  { key: "PRIS_EN_CHARGE", label: "Pris en charge", color: "#8b5cf6" },
  { key: "EN_ROUTE", label: "En route", color: "#06b6d4" },
  { key: "CLOTUREE", label: "Clôturée", color: "#10b981" },
  { key: "ECHEC", label: "Échec", color: "#dc2626" },
];
const STAGE_META = new Map(STAGES.map((s) => [s.key, s]));

function computeStage(a: AffaireRow, livraison: Livraison | undefined): Stage {
  if (a.statut === "CLOTUREE") return "CLOTUREE";
  if (a.statut === "EN_ATTENTE") return "NOUVELLE";
  // VALIDEE à partir d'ici.
  if (a.modeFinalisation === "RETRAIT") return "PRETE";
  if (livraison) {
    if (livraison.statut === "ECHEC") return "ECHEC";
    if (livraison.statut === "PRIS_EN_CHARGE") return "PRIS_EN_CHARGE";
    if (livraison.statut === "EN_ROUTE") return "EN_ROUTE";
  }
  return "PRETE";
}

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
  const [vue, setVue] = useState<"kanban" | "liste">("kanban");
  const [recherche, setRecherche] = useState("");
  const [filtreStage, setFiltreStage] = useState<Stage | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const livraisonByAffaire = new Map(livraisons.map((l) => [l.affaireId, l]));

  const enrichies = useMemo(
    () =>
      affaires
        .filter((a) => a.statut !== "ANNULEE")
        .map((a) => {
          const livraison = livraisonByAffaire.get(a.id);
          return { affaire: a, livraison, stage: computeStage(a, livraison) };
        }),
    [affaires, livraisons]
  );

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return enrichies.filter(({ affaire, stage }) => {
      if (filtreStage && stage !== filtreStage) return false;
      if (!q) return true;
      return affaire.numero.toLowerCase().includes(q) || affaire.clientNom.toLowerCase().includes(q);
    });
  }, [enrichies, recherche, filtreStage]);

  const selected = selectedId != null ? enrichies.find((e) => e.affaire.id === selectedId) : undefined;

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

  function Carte({ affaire, livraison, stage }: { affaire: AffaireRow; livraison?: Livraison; stage: Stage }) {
    const meta = STAGE_META.get(stage)!;
    const active = affaire.id === selectedId;
    return (
      <div
        onClick={() => setSelectedId(affaire.id)}
        className="cursor-pointer rounded-md border p-2.5 transition-colors"
        style={{ borderColor: active ? meta.color : "var(--border)", background: active ? `${meta.color}14` : "var(--card)" }}
      >
        <div className="mb-0.5 font-mono text-[11px] text-muted-foreground">{affaire.numero}</div>
        <div className="truncate text-sm font-semibold text-foreground">{affaire.clientNom}</div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{affaire.modeFinalisation === "RETRAIT" ? "Retrait" : "Livraison"}</span>
          <span className="font-semibold tabular-nums text-foreground">{formatFcfa(affaire.montantTtc)}</span>
        </div>
      </div>
    );
  }

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Commandes" modules={modules}>
      <div className="flex h-full min-h-0 flex-col gap-4 p-6">
        {mesFondsEnCirculation.length > 0 && (
          <div className="rounded-md border-l-2 border-amber-500 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <b>Mes fonds en circulation (§8.2)</b> — encaissé sur le terrain, pas encore remis à la Trésorerie :
            <ul className="mt-1 list-disc pl-5">
              {mesFondsEnCirculation.map((f, i) => (
                <li key={i}>
                  {f.affaireNumero} — {formatFcfa(f.montantAttendu)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {msg && <p className="text-sm text-destructive">{msg}</p>}

        <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-foreground">Commandes</h1>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <Input
              placeholder="Rechercher (n°, client...)"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="h-9 w-56"
            />
            <div className="flex overflow-hidden rounded-md border border-border">
              <button
                onClick={() => setVue("kanban")}
                className={`px-3 py-1.5 text-xs font-semibold ${vue === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                🗂️ Kanban
              </button>
              <button
                onClick={() => setVue("liste")}
                className={`px-3 py-1.5 text-xs font-semibold ${vue === "liste" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                📋 Liste
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-wrap gap-2">
          {STAGES.map((s) => {
            const count = enrichies.filter((e) => e.stage === s.key).length;
            const active = filtreStage === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setFiltreStage(active ? null : s.key)}
                className="rounded-md border px-3 py-1.5 text-left"
                style={{ borderColor: active ? s.color : "var(--border)", background: "var(--card)" }}
              >
                <div className="text-[11px] text-muted-foreground">{s.label}</div>
                <div className="text-base font-bold tabular-nums" style={{ color: s.color }}>
                  {count}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex min-h-0 flex-1 gap-4">
          {vue === "kanban" ? (
            <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto">
              {STAGES.map((s) => {
                const cartes = filtrees.filter((e) => e.stage === s.key);
                return (
                  <div key={s.key} className="flex w-56 flex-shrink-0 flex-col rounded-lg border border-border bg-muted/20">
                    <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-3 py-2">
                      <span className="text-xs font-bold text-foreground">{s.label}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{cartes.length}</span>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                      {cartes.map((e) => (
                        <Carte key={e.affaire.id} affaire={e.affaire} livraison={e.livraison} stage={e.stage} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="min-w-0 flex-1 overflow-y-auto rounded-md border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="p-2.5">N°</th>
                    <th className="p-2.5">Client</th>
                    <th className="p-2.5">Mode</th>
                    <th className="p-2.5">Étape</th>
                    <th className="p-2.5 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrees.map(({ affaire, stage }) => {
                    const meta = STAGE_META.get(stage)!;
                    return (
                      <tr
                        key={affaire.id}
                        onClick={() => setSelectedId(affaire.id)}
                        className={`cursor-pointer border-b border-border last:border-0 hover:bg-muted/30 ${affaire.id === selectedId ? "bg-muted/40" : ""}`}
                      >
                        <td className="p-2.5 font-mono text-xs text-muted-foreground">{affaire.numero}</td>
                        <td className="p-2.5">{affaire.clientNom}</td>
                        <td className="p-2.5 text-xs text-muted-foreground">{affaire.modeFinalisation === "RETRAIT" ? "Retrait" : "Livraison"}</td>
                        <td className="p-2.5">
                          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: meta.color, border: `1px solid ${meta.color}` }}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-semibold tabular-nums">{formatFcfa(affaire.montantTtc)}</td>
                      </tr>
                    );
                  })}
                  {filtrees.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                        Aucune commande.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Fiche — panneau de détail persistant (droite), toujours synchronisé sur la même donnée
              que le Kanban/la Liste puisqu'il vient du même `enrichies`. */}
          <div className="w-80 flex-shrink-0 overflow-y-auto rounded-md border border-border bg-card p-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Cliquez une commande à gauche pour voir sa fiche.</p>
            ) : (
              <FicheCommande
                affaire={selected.affaire}
                livraison={selected.livraison}
                stage={selected.stage}
                livreurs={livreurs}
                busy={busy}
                soldeParAffaire={soldeParAffaire}
                montantCollecte={montantCollecte}
                setMontantCollecte={setMontantCollecte}
                onRetrait={handleRetrait}
                onLivraison={handleLivraison}
                onAssignerLivreur={handleAssignerLivreur}
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function FicheCommande({
  affaire,
  livraison,
  stage,
  livreurs,
  busy,
  soldeParAffaire,
  montantCollecte,
  setMontantCollecte,
  onRetrait,
  onLivraison,
  onAssignerLivreur,
}: {
  affaire: AffaireRow;
  livraison?: Livraison;
  stage: Stage;
  livreurs: Livreur[];
  busy: number | null;
  soldeParAffaire: Record<number, number>;
  montantCollecte: Record<number, string>;
  setMontantCollecte: (v: Record<number, string> | ((prev: Record<number, string>) => Record<number, string>)) => void;
  onRetrait: (affaireId: number) => void;
  onLivraison: (livraisonId: number, next: "PRIS_EN_CHARGE" | "EN_ROUTE" | "LIVREE" | "ECHEC", montantEspeces?: number) => void;
  onAssignerLivreur: (livraisonId: number, livreurId: number) => void;
}) {
  const meta = STAGE_META.get(stage)!;
  const etapesRetrait = ["Nouvelle", "Prête", "Retirée"];
  const etapesLivraison = ["Nouvelle", "Prête", "Pris en charge", "En route", "Livrée"];
  const etapes = affaire.modeFinalisation === "RETRAIT" ? etapesRetrait : etapesLivraison;
  const etapeIndex =
    affaire.modeFinalisation === "RETRAIT"
      ? { NOUVELLE: 0, PRETE: 1, CLOTUREE: 2 }[stage === "CLOTUREE" ? "CLOTUREE" : stage === "PRETE" ? "PRETE" : "NOUVELLE"] ?? 0
      : { NOUVELLE: 0, PRETE: 1, PRIS_EN_CHARGE: 2, EN_ROUTE: 3, CLOTUREE: 4, ECHEC: 3 }[stage] ?? 0;

  const solde = Number(affaire.montantTtc) - (soldeParAffaire[affaire.id] ?? 0);

  return (
    <div>
      <div className="mb-1 font-mono text-[11px] text-muted-foreground">{affaire.numero}</div>
      <div className="text-lg font-bold text-foreground">{affaire.clientNom}</div>
      {affaire.clientContact && <div className="text-xs text-muted-foreground">{affaire.clientContact}</div>}
      <div className="mt-2 flex items-center gap-2">
        <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ background: meta.color }}>
          {meta.label}
        </span>
        <span className="text-xs text-muted-foreground">{affaire.modeFinalisation === "RETRAIT" ? "Retrait boutique" : "Livraison"}</span>
      </div>

      {stage === "ECHEC" && (
        <div className="mt-3 rounded-md border border-destructive p-2 text-xs text-destructive">
          Échec de livraison — contactez le client pour reprogrammer.
        </div>
      )}

      <div className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Progression</div>
      <div className="mb-5 flex items-center">
        {etapes.map((label, i) => (
          <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs text-white"
              style={{ background: i <= etapeIndex ? meta.color : "var(--muted)" }}
            >
              {i < etapeIndex ? "✓" : ""}
            </div>
            <div className="text-center text-[10px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {affaire.modeFinalisation === "RETRAIT" && stage === "PRETE" && (
        <Button size="sm" className="w-full" disabled={busy === affaire.id} onClick={() => onRetrait(affaire.id)}>
          Marquer retirée
        </Button>
      )}

      {affaire.modeFinalisation === "LIVRAISON" && livraison && (
        <div className="space-y-2">
          {(stage === "PRETE" || stage === "PRIS_EN_CHARGE") && (
            <select
              value={livraison.livreurId ?? ""}
              onChange={(e) => onAssignerLivreur(livraison.id, Number(e.target.value))}
              disabled={busy === livraison.id}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Livreur...</option>
              {livreurs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nom}
                </option>
              ))}
            </select>
          )}
          {stage === "PRETE" && (
            <Button size="sm" className="w-full" disabled={busy === livraison.id} onClick={() => onLivraison(livraison.id, "PRIS_EN_CHARGE")}>
              Prendre en charge
            </Button>
          )}
          {stage === "PRIS_EN_CHARGE" && (
            <Button size="sm" className="w-full" disabled={busy === livraison.id} onClick={() => onLivraison(livraison.id, "EN_ROUTE")}>
              Mettre en route
            </Button>
          )}
          {stage === "EN_ROUTE" && (
            <>
              {solde > 0 && (
                <Input
                  type="number"
                  min="0"
                  placeholder={`Espèces reçues (solde ${formatFcfa(solde)})`}
                  value={montantCollecte[livraison.id] ?? ""}
                  onChange={(e) => setMontantCollecte((prev) => ({ ...prev, [livraison.id]: e.target.value }))}
                  className="h-9 text-sm"
                />
              )}
              <Button
                size="sm"
                className="w-full"
                disabled={busy === livraison.id}
                onClick={() => onLivraison(livraison.id, "LIVREE", solde > 0 ? Number(montantCollecte[livraison.id] ?? 0) : undefined)}
              >
                Marquer livrée
              </Button>
            </>
          )}
        </div>
      )}

      <div className="mt-5 space-y-1.5 border-t border-border pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Créée le</span>
          <span>{formatDate(affaire.dateCreation)}</span>
        </div>
        {livraison?.adresse && (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Adresse</span>
            <span className="text-right">{livraison.adresse}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Montant</span>
          <span className="font-semibold">{formatFcfa(affaire.montantTtc)}</span>
        </div>
        {solde > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Solde</span>
            <span className="font-semibold text-amber-600">{formatFcfa(solde)}</span>
          </div>
        )}
      </div>

      <a
        href={`/api/documents/bon-livraison/${affaire.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block text-center text-xs font-semibold text-primary underline-offset-2 hover:underline"
      >
        Bon de livraison
      </a>
    </div>
  );
}
