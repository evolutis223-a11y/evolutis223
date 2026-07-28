"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { affaires, articles, clients, demandesValidationStock, lignesAffaire, reglements, variantes } from "@/db/schema";
import { ajouterReglement, creerAffaire, validerAffaire, type LigneInput, type ReglementState } from "./actions";

type Client = typeof clients.$inferSelect;
type Article = typeof articles.$inferSelect;
type Variante = typeof variantes.$inferSelect;
type AffaireRow = {
  id: number;
  numero: string;
  type: string;
  statut: string;
  montantTtc: string;
  immuable: boolean;
  dateCreation: Date;
  clientNom: string;
  clientId: number;
};
type LigneRow = typeof lignesAffaire.$inferSelect;
type ReglementRow = typeof reglements.$inferSelect;
type DemandeRow = typeof demandesValidationStock.$inferSelect;

function formatFcfa(v: string | number) {
  return `${Math.round(Number(v)).toLocaleString("fr-FR")} F`;
}

const TYPE_LABEL: Record<string, string> = {
  COMMANDE_ATTENTE: "Commande en attente",
  DEVIS: "Devis",
  PROFORMA: "Proforma",
  BON_COMMANDE: "Bon de commande",
  TICKET: "Ticket",
  FACTURE: "Facture",
  AVOIR: "Avoir",
};

const initialReglementState: ReglementState = { error: null };

export function LigneEditorRow({
  articlesList,
  variantesList,
  ligne,
  onChange,
  onRemove,
}: {
  articlesList: Article[];
  variantesList: Variante[];
  ligne: LigneInput;
  onChange: (l: LigneInput) => void;
  onRemove: () => void;
}) {
  const article = articlesList.find((a) => a.id === ligne.articleId);
  const variantesArticle = variantesList.filter((v) => v.articleId === ligne.articleId);

  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-border p-3">
      <div className="space-y-2">
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          value={ligne.articleId || ""}
          onChange={(e) => {
            const id = Number(e.target.value);
            const a = articlesList.find((x) => x.id === id);
            // Famille A : la variante (taille/couleur) se choisit explicitement ci-dessous.
            // Autres familles avec stock (B) : une seule variante par défaut existe déjà
            // (créée à l'approvisionnement, §4.3) -- on la résout automatiquement, sinon le
            // contrôle de stock et le décrément FIFO seraient silencieusement ignorés pour
            // toute vente d'un article Famille B.
            const varianteParDefaut = a?.famille !== "A" ? variantesList.find((v) => v.articleId === id) : null;
            onChange({
              ...ligne,
              articleId: id,
              varianteId: varianteParDefaut?.id ?? null,
              prixUnitaire: a ? Number(a.prixVente) : 0,
            });
          }}
        >
          <option value="">Choisir un article...</option>
          {articlesList.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nom} ({a.code})
            </option>
          ))}
        </select>

        {article?.famille === "A" && (
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={ligne.varianteId ?? ""}
            onChange={(e) => onChange({ ...ligne, varianteId: Number(e.target.value) })}
          >
            <option value="">Choisir une variante (taille/couleur)...</option>
            {variantesArticle.map((v) => (
              <option key={v.id} value={v.id}>
                {v.taille} {v.couleur}
              </option>
            ))}
          </select>
        )}

        <div className="flex gap-2">
          <Input
            type="number"
            min="1"
            value={ligne.quantite}
            onChange={(e) => onChange({ ...ligne, quantite: Number(e.target.value) })}
            placeholder="Qté"
          />
          <Input
            type="number"
            min="0"
            value={ligne.prixUnitaire}
            onChange={(e) => onChange({ ...ligne, prixUnitaire: Number(e.target.value) })}
            placeholder="Prix unitaire"
          />
        </div>
      </div>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive" aria-label="Retirer">
        &times;
      </button>
    </div>
  );
}

function NouvelleAffaireDrawer({
  clients,
  articlesList,
  variantesList,
  onClose,
}: {
  clients: Client[];
  articlesList: Article[];
  variantesList: Variante[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState<number | "">("");
  const [lignes, setLignes] = useState<LigneInput[]>([{ articleId: 0, varianteId: null, quantite: 1, prixUnitaire: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [modeFinalisation, setModeFinalisation] = useState<"" | "RETRAIT" | "LIVRAISON">("");
  const [adresse, setAdresse] = useState("");

  const total = lignes.reduce((acc, l) => acc + l.quantite * l.prixUnitaire, 0);

  async function submit() {
    setError(null);
    if (!clientId) return setError("Client requis.");
    const valid = lignes.filter((l) => l.articleId);
    if (valid.length === 0) return setError("Au moins une ligne requise.");
    if (modeFinalisation === "LIVRAISON" && !adresse.trim()) return setError("Adresse de livraison requise.");
    setPending(true);
    const res = await creerAffaire(
      Number(clientId),
      valid,
      modeFinalisation || null,
      modeFinalisation === "LIVRAISON" ? adresse.trim() : null
    );
    setPending(false);
    if (res.error) return setError(res.error);
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/40" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="h-full w-full max-w-lg overflow-y-auto bg-background p-6 shadow-xl">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-foreground">Nouvelle affaire</h2>
          <button onClick={onClose} className="text-xl leading-none text-muted-foreground" aria-label="Fermer">
            &times;
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Entre d&apos;abord comme Commande en attente (§8.1) — la validation contrôle le stock et
          décrémente en FIFO.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Client</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={clientId}
              onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Choisir un client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
              Finalisation (optionnel — vide = vente comptoir directe)
            </label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={modeFinalisation}
              onChange={(e) => setModeFinalisation(e.target.value as "" | "RETRAIT" | "LIVRAISON")}
            >
              <option value="">Vente comptoir directe</option>
              <option value="RETRAIT">Retrait en boutique (préparation avant remise)</option>
              <option value="LIVRAISON">Livraison</option>
            </select>
            {modeFinalisation === "LIVRAISON" && (
              <input
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                placeholder="Adresse de livraison"
                className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              />
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Lignes</label>
            <div className="space-y-2">
              {lignes.map((l, i) => (
                <LigneEditorRow
                  key={i}
                  articlesList={articlesList}
                  variantesList={variantesList}
                  ligne={l}
                  onChange={(nl) => setLignes((arr) => arr.map((x, j) => (j === i ? nl : x)))}
                  onRemove={() => setLignes((arr) => arr.filter((_, j) => j !== i))}
                />
              ))}
            </div>
            <button
              onClick={() => setLignes((arr) => [...arr, { articleId: 0, varianteId: null, quantite: 1, prixUnitaire: 0 }])}
              className="mt-2 text-sm font-medium text-primary"
            >
              + Ajouter une ligne
            </button>
          </div>

          <div className="border-t border-border pt-3 text-right text-lg font-semibold tabular-nums text-foreground">
            Total : {formatFcfa(total)}
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="button" disabled={pending} onClick={submit}>
              {pending ? "Création..." : "Créer l'affaire"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReglementForm({ affaireId, onDone }: { affaireId: number; onDone: () => void }) {
  const [state, action, pending] = useActionState(ajouterReglement, initialReglementState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) onDone();
    wasPending.current = pending;
  }, [pending, state.error, onDone]);

  return (
    <form
      action={(fd) => {
        fd.set("affaireId", String(affaireId));
        action(fd);
      }}
      className="mt-3 flex items-end gap-2"
    >
      <Input name="montant" type="number" min="1" placeholder="Montant" className="w-32" required />
      <select name="mode" className="flex h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm" required>
        <option value="ESPECES">Espèces</option>
        <option value="MOBILE_MONEY">Mobile Money</option>
        <option value="VIREMENT">Virement</option>
        <option value="CARTE">Carte</option>
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "..." : "Encaisser"}
      </Button>
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
    </form>
  );
}

export function AffairesClient({
  clients,
  articles,
  variantes,
  affaires,
  lignes,
  reglements,
  demandesEnAttente,
}: {
  clients: Client[];
  articles: Article[];
  variantes: Variante[];
  affaires: AffaireRow[];
  lignes: LigneRow[];
  reglements: ReglementRow[];
  demandesEnAttente: DemandeRow[];
}) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);

  const lignesByAffaire = useMemo(() => {
    const m = new Map<number, LigneRow[]>();
    for (const l of lignes) {
      if (!m.has(l.affaireId)) m.set(l.affaireId, []);
      m.get(l.affaireId)!.push(l);
    }
    return m;
  }, [lignes]);

  const reglementsByAffaire = useMemo(() => {
    const m = new Map<number, ReglementRow[]>();
    for (const r of reglements) {
      if (!m.has(r.affaireId)) m.set(r.affaireId, []);
      m.get(r.affaireId)!.push(r);
    }
    return m;
  }, [reglements]);

  const demandesByAffaire = useMemo(() => {
    const m = new Map<number, DemandeRow[]>();
    for (const d of demandesEnAttente) {
      if (!m.has(d.affaireId)) m.set(d.affaireId, []);
      m.get(d.affaireId)!.push(d);
    }
    return m;
  }, [demandesEnAttente]);

  async function handleValider(affaireId: number) {
    setValidating(true);
    setValidationMsg(null);
    const res = await validerAffaire(affaireId);
    setValidating(false);
    if (res.error) setValidationMsg(res.error);
    else if (res.blocked) setValidationMsg("Stock insuffisant — demande de validation envoyée (Admin/Super Admin, Phase 2).");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Affaires</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Moteur de vente unifié (§5) — Devis, Commandes, Factures/Tickets, Avoirs.
          </p>
        </div>
        <Button onClick={() => setDrawerOpen(true)}>+ Nouvelle affaire</Button>
      </div>

      <div className="mt-5 space-y-2">
        {affaires.length === 0 && (
          <p className="rounded-md border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Aucune affaire encore.
          </p>
        )}
        {affaires.map((a) => {
          const isOpen = expanded === a.id;
          const totalRegle = (reglementsByAffaire.get(a.id) ?? []).reduce((acc, r) => acc + Number(r.montant), 0);
          const solde = Number(a.montantTtc) - totalRegle;
          const bloquee = (demandesByAffaire.get(a.id) ?? []).length > 0;
          return (
            <div key={a.id} className="rounded-md border border-border">
              <div className="flex cursor-pointer items-center justify-between gap-4 p-4" onClick={() => setExpanded(isOpen ? null : a.id)}>
                <div>
                  <div className="font-mono text-sm font-medium text-foreground">{a.numero}</div>
                  <div className="text-xs text-muted-foreground">{a.clientNom}</div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                    {TYPE_LABEL[a.type] ?? a.type}
                  </span>
                  {bloquee && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      Bloquée — validation stock
                    </span>
                  )}
                  <span className="font-semibold tabular-nums text-foreground">{formatFcfa(a.montantTtc)}</span>
                  {a.immuable && solde > 0 && (
                    <span className="text-xs text-amber-700 dark:text-amber-400">Solde : {formatFcfa(solde)}</span>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="space-y-3 border-t border-border p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-muted-foreground">
                        <th className="py-1">Article</th>
                        <th className="py-1">Qté</th>
                        <th className="py-1">PU</th>
                        <th className="py-1">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(lignesByAffaire.get(a.id) ?? []).map((l) => {
                        const art = articles.find((x) => x.id === l.articleId);
                        const vnt = variantes.find((v) => v.id === l.varianteId);
                        return (
                          <tr key={l.id} className="border-t border-border">
                            <td className="py-1.5">
                              {art?.nom} {vnt ? `— ${vnt.taille ?? ""} ${vnt.couleur ?? ""}` : ""}
                            </td>
                            <td className="py-1.5 tabular-nums">{l.quantite}</td>
                            <td className="py-1.5 tabular-nums">{formatFcfa(l.prixUnitaire)}</td>
                            <td className="py-1.5 tabular-nums">{formatFcfa(Number(l.prixUnitaire) * l.quantite)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {bloquee && (
                    <p className="rounded-md border-l-2 border-amber-500 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      Réserve détail insuffisante pour au moins une ligne. Demande envoyée pour
                      validation Admin/Super Admin — décision (Autoriser/Recharger/Refuser) sur{" "}
                      <a href="/validations" className="underline">
                        /validations
                      </a>{" "}
                      (§9). Pas de décrément tant que non résolu.
                    </p>
                  )}

                  {!a.immuable && !bloquee && (
                    <Button size="sm" disabled={validating} onClick={() => handleValider(a.id)}>
                      {validating ? "Validation..." : "Valider (contrôle stock + décrément)"}
                    </Button>
                  )}

                  {a.immuable && (
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Réglé : {formatFcfa(totalRegle)} — Solde : {formatFcfa(solde)}
                      </div>
                      {solde > 0 && <ReglementForm affaireId={a.id} onDone={() => router.refresh()} />}
                    </div>
                  )}

                  {validationMsg && <p className="text-sm text-destructive">{validationMsg}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {drawerOpen && (
        <NouvelleAffaireDrawer
          clients={clients}
          articlesList={articles}
          variantesList={variantes}
          onClose={() => {
            setDrawerOpen(false);
            router.refresh();
          }}
        />
      )}
    </main>
  );
}
