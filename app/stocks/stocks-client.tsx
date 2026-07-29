"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { articles } from "@/db/schema";
import {
  ajouterComposantKit,
  approvisionnerFamilleA,
  approvisionnerFamilleB,
  retirerComposantKit,
  type ComposantKitState,
  type StockActionState,
} from "./actions";

type Article = typeof articles.$inferSelect;
type Fournisseur = { id: number; nom: string };

interface RecetteRow {
  id: number;
  composantArticleId: number;
  composantNom: string;
  varianteId: number | null;
  taille: string | null;
  couleur: string | null;
  quantiteRequise: number;
}

interface KitData {
  article: Article;
  recette: RecetteRow[];
  stock: {
    stockKitCalcule: number;
    composantLimitant: {
      composantArticleId: number;
      varianteId: number;
      quantiteRequise: number;
      stockVariante: number;
      stockPossible: number;
    } | null;
  };
}

interface VarianteRow {
  id: number;
  articleId: number;
  taille: string | null;
  couleur: string | null;
  seuilAlerte: number;
  stockDetail: number | null;
  stockGros: number | null;
  reserveDetail: number | null;
}

const TAILLES_COURANTES = ["S", "M", "L", "XL", "XXL"];
const initialState: StockActionState = { error: null };

function StockBadge({ qty, seuil }: { qty: number; seuil: number }) {
  if (qty <= 0) {
    return (
      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
        Rupture
      </span>
    );
  }
  if (qty <= seuil) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        Faible
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
      OK
    </span>
  );
}

function FournisseurSelect({ fournisseurs }: { fournisseurs: Fournisseur[] }) {
  if (fournisseurs.length === 0) return null;
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
        Fournisseur (optionnel)
      </label>
      <select
        name="fournisseurId"
        defaultValue=""
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
      >
        <option value="">Non renseigné</option>
        {fournisseurs.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nom}
          </option>
        ))}
      </select>
    </div>
  );
}

function ApproFamilleAForm({
  article,
  fournisseurs,
  onDone,
}: {
  article: Article;
  fournisseurs: Fournisseur[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(approvisionnerFamilleA, initialState);
  const [douzaines, setDouzaines] = useState("1");
  const [couleur, setCouleur] = useState("");
  const [prix, setPrix] = useState("");
  const [reserve, setReserve] = useState("0");
  const [repartition, setRepartition] = useState<Record<string, string>>({ M: "2", L: "4", XL: "4", XXL: "2" });
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) onDone();
    wasPending.current = pending;
  }, [pending, state.error, onDone]);

  const produitTotal = useMemo(() => {
    const d = Number(douzaines) || 0;
    return TAILLES_COURANTES.reduce((acc, t) => acc + (Number(repartition[t]) || 0) * d, 0);
  }, [douzaines, repartition]);

  return (
    <form
      action={(fd) => {
        fd.set("articleId", String(article.id));
        const repJson: Record<string, number> = {};
        for (const t of TAILLES_COURANTES) {
          const v = Number(repartition[t]) || 0;
          if (v > 0) repJson[t] = v;
        }
        fd.set("repartitionJson", JSON.stringify(repJson));
        action(fd);
      }}
      className="space-y-4"
    >
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
          Douzaines achetées
        </label>
        <Input
          name="douzaines"
          type="number"
          min="1"
          value={douzaines}
          onChange={(e) => setDouzaines(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
          Répartition par taille (pour 1 douzaine)
        </label>
        <div className="grid grid-cols-5 gap-2">
          {TAILLES_COURANTES.map((t) => (
            <div key={t}>
              <div className="mb-1 text-center text-xs text-muted-foreground">{t}</div>
              <Input
                type="number"
                min="0"
                value={repartition[t] ?? ""}
                onChange={(e) => setRepartition((r) => ({ ...r, [t]: e.target.value }))}
                className="text-center"
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Total produit : <b className="text-foreground">{produitTotal} pièces</b> ({douzaines || 0} douzaine(s))
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Couleur</label>
        <Input name="couleur" value={couleur} onChange={(e) => setCouleur(e.target.value)} placeholder="Ex. Bleu marine" required />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
          Prix d&apos;achat unitaire (F CFA)
        </label>
        <Input
          name="prixAchatUnitaire"
          type="number"
          min="0"
          value={prix}
          onChange={(e) => setPrix(e.target.value)}
          placeholder="Ex. 6000"
          required
        />
      </div>

      <FournisseurSelect fournisseurs={fournisseurs} />

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
          Réserve détail demandée (en PIÈCES, pas en douzaines)
        </label>
        <Input
          name="reserveDetailPieces"
          type="number"
          min="0"
          max={produitTotal}
          value={reserve}
          onChange={(e) => setReserve(e.target.value)}
        />
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          ⚠ Piège fréquent : taper « 1 » réserve 1 pièce, pas 1 douzaine. Répartie automatiquement au
          prorata des tailles (§16.8).
        </p>
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : "Approvisionner"}
        </Button>
      </div>
    </form>
  );
}

function ApproFamilleBForm({
  article,
  fournisseurs,
  onDone,
}: {
  article: Article;
  fournisseurs: Fournisseur[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(approvisionnerFamilleB, initialState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) onDone();
    wasPending.current = pending;
  }, [pending, state.error, onDone]);

  return (
    <form
      action={(fd) => {
        fd.set("articleId", String(article.id));
        action(fd);
      }}
      className="space-y-4"
    >
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
          Quantité
        </label>
        <Input name="quantite" type="number" min="1" placeholder="Ex. 30" required />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
          Prix d&apos;achat unitaire (F CFA)
        </label>
        <Input name="prixAchatUnitaire" type="number" min="0" placeholder="Ex. 1500" required />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
          Seuil d&apos;alerte
        </label>
        <Input name="seuilAlerte" type="number" min="0" placeholder="Ex. 10" />
      </div>

      <FournisseurSelect fournisseurs={fournisseurs} />

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : "Approvisionner"}
        </Button>
      </div>
    </form>
  );
}

const initialComposantState: ComposantKitState = { error: null };

function AjouterComposantForm({
  kitArticleId,
  stockableArticles,
  variantes,
  onDone,
}: {
  kitArticleId: number;
  stockableArticles: Article[];
  variantes: VarianteRow[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(ajouterComposantKit, initialComposantState);
  const [composantArticleId, setComposantArticleId] = useState("");
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) onDone();
    wasPending.current = pending;
  }, [pending, state.error, onDone]);

  const variantesDuComposant = variantes.filter((v) => v.articleId === Number(composantArticleId));
  const composantFamille = stockableArticles.find((a) => a.id === Number(composantArticleId))?.famille;

  return (
    <form
      action={(fd) => {
        fd.set("kitArticleId", String(kitArticleId));
        action(fd);
      }}
      className="mt-3 space-y-3 rounded-md border border-border bg-muted/30 p-3"
    >
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
          Composant
        </label>
        <select
          name="composantArticleId"
          value={composantArticleId}
          onChange={(e) => setComposantArticleId(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          required
        >
          <option value="">Choisir un article...</option>
          {stockableArticles
            .filter((a) => a.id !== kitArticleId)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom} ({a.code})
              </option>
            ))}
        </select>
      </div>

      {composantArticleId && (
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
            Variante exacte (§8.3 — jamais une famille entière de tailles)
          </label>
          <select
            name="varianteId"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            required
          >
            <option value="">Choisir une variante...</option>
            {variantesDuComposant.map((v) => (
              <option key={v.id} value={v.id}>
                {v.taille || v.couleur ? `${v.taille ?? ""} ${v.couleur ?? ""}`.trim() : "Défaut"} —{" "}
                {composantFamille === "A" ? "gros" : "stock"}: {composantFamille === "A" ? v.stockGros ?? 0 : v.stockDetail ?? 0}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
          Quantité requise par kit
        </label>
        <Input name="quantiteRequise" type="number" min="1" placeholder="Ex. 1" required />
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Ajout..." : "Ajouter"}
        </Button>
      </div>
    </form>
  );
}

function KitsSection({
  kits,
  stockableArticles,
  variantes,
}: {
  kits: KitData[];
  stockableArticles: Article[];
  variantes: VarianteRow[];
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [addingTo, setAddingTo] = useState<number | null>(null);

  if (kits.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold text-foreground">Kits (Famille E, §8.3)</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Jamais de quantité saisie directement — recalculé depuis la recette, goulot
        d&apos;étranglement sur le composant/variante le plus limitant (stock gros pour un
        composant Famille A, réserve détail toujours exclue, §8.3 point 4).
      </p>
      <div className="mt-3 space-y-3">
        {kits.map(({ article: k, recette, stock }) => {
          const isOpen = expanded === k.id;
          return (
            <div key={k.id} className="rounded-md border border-border">
              <div
                className="flex cursor-pointer items-center justify-between gap-4 p-4"
                onClick={() => setExpanded(isOpen ? null : k.id)}
              >
                <div>
                  <div className="font-medium text-foreground">{k.nom}</div>
                  <div className="font-mono text-xs text-muted-foreground">{k.code}</div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    Stock calculé :{" "}
                    <b className="text-foreground tabular-nums">{stock.stockKitCalcule}</b>
                  </span>
                  <StockBadge qty={stock.stockKitCalcule} seuil={0} />
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-border px-4 py-3">
                  {stock.composantLimitant && (
                    <p className="mb-3 rounded-md border-l-2 border-amber-500 bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      Composant limitant : variante {stock.composantLimitant.varianteId} —{" "}
                      {stock.composantLimitant.stockVariante} disponible ÷{" "}
                      {stock.composantLimitant.quantiteRequise} requis ={" "}
                      {stock.composantLimitant.stockPossible} kit(s) possible(s).
                    </p>
                  )}

                  {recette.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aucun composant — recette vide, aucune vente possible.
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase text-muted-foreground">
                          <th className="py-1.5">Composant</th>
                          <th className="py-1.5">Variante</th>
                          <th className="py-1.5">Qté requise</th>
                          <th className="py-1.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {recette.map((r) => (
                          <tr key={r.id} className="border-t border-border">
                            <td className="py-1.5">{r.composantNom}</td>
                            <td className="py-1.5">
                              {r.taille || r.couleur ? `${r.taille ?? ""} ${r.couleur ?? ""}`.trim() : "Défaut"}
                            </td>
                            <td className="py-1.5 tabular-nums">{r.quantiteRequise}</td>
                            <td className="py-1.5 text-right">
                              <button
                                onClick={() => retirerComposantKit(r.id)}
                                className="text-xs text-destructive hover:underline"
                              >
                                Retirer
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {addingTo === k.id ? (
                    <AjouterComposantForm
                      kitArticleId={k.id}
                      stockableArticles={stockableArticles}
                      variantes={variantes}
                      onDone={() => setAddingTo(null)}
                    />
                  ) : (
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => setAddingTo(k.id)}>
                      + Ajouter un composant
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StocksClient({
  articles: initialArticles,
  variantes,
  kits,
  fournisseurs,
}: {
  articles: Article[];
  variantes: VarianteRow[];
  kits: KitData[];
  fournisseurs: Fournisseur[];
}) {
  const [approArticle, setApproArticle] = useState<Article | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const stockables = initialArticles.filter((a) => a.famille === "A" || a.famille === "B");

  const variantesByArticle = useMemo(() => {
    const m = new Map<number, VarianteRow[]>();
    for (const v of variantes) {
      if (!m.has(v.articleId)) m.set(v.articleId, []);
      m.get(v.articleId)!.push(v);
    }
    return m;
  }, [variantes]);

  function totals(articleId: number, famille: string) {
    const rows = variantesByArticle.get(articleId) ?? [];
    if (famille === "A") {
      return {
        detail: rows.reduce((a, r) => a + (r.stockDetail ?? 0), 0),
        gros: rows.reduce((a, r) => a + (r.stockGros ?? 0), 0),
        reserve: rows.reduce((a, r) => a + (r.reserveDetail ?? 0), 0),
      };
    }
    return {
      detail: rows.reduce((a, r) => a + (r.stockDetail ?? 0), 0),
      gros: 0,
      reserve: 0,
    };
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-xl font-semibold text-foreground">Stocks</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Seules les familles A (textile/douzaine) et B (unité simple) ont un stock direct
        approvisionné ici — C (service) et D (fabrication sur commande) n&apos;ont pas de stock
        (§5) ; E (kit) a son stock recalculé depuis sa recette, plus bas.
      </p>

      <div className="mt-5 space-y-3">
        {stockables.length === 0 && (
          <p className="rounded-md border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Aucun article des familles A/B pour l&apos;instant — créez-en dans le Catalogue.
          </p>
        )}
        {stockables.map((a) => {
          const t = totals(a.id, a.famille);
          const rows = variantesByArticle.get(a.id) ?? [];
          const isOpen = expanded === a.id;
          return (
            <div key={a.id} className="rounded-md border border-border">
              <div
                className="flex cursor-pointer items-center justify-between gap-4 p-4"
                onClick={() => setExpanded(isOpen ? null : a.id)}
              >
                <div>
                  <div className="font-medium text-foreground">{a.nom}</div>
                  <div className="font-mono text-xs text-muted-foreground">{a.code}</div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  {a.famille === "A" ? (
                    <>
                      <span className="text-muted-foreground">
                        Détail : <b className="text-foreground tabular-nums">{t.detail}</b>
                      </span>
                      <span className="text-muted-foreground">
                        Gros : <b className="text-foreground tabular-nums">{t.gros}</b>
                      </span>
                      <span className="text-muted-foreground">
                        Réservé : <b className="text-foreground tabular-nums">{t.reserve}</b>
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      Stock : <b className="text-foreground tabular-nums">{t.detail}</b>
                    </span>
                  )}
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setApproArticle(a);
                    }}
                  >
                    Approvisionner
                  </Button>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-border px-4 py-3">
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Pas encore de stock enregistré.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase text-muted-foreground">
                          <th className="py-1.5">Variante</th>
                          {a.famille === "A" && <th className="py-1.5">Gros</th>}
                          <th className="py-1.5">Détail dispo.</th>
                          {a.famille === "A" && <th className="py-1.5">Réservé</th>}
                          <th className="py-1.5">Seuil</th>
                          <th className="py-1.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => {
                          const dispo = r.stockDetail ?? 0;
                          return (
                            <tr key={r.id} className="border-t border-border">
                              <td className="py-1.5">
                                {r.taille || r.couleur ? `${r.taille ?? ""} ${r.couleur ?? ""}`.trim() : "Défaut"}
                              </td>
                              {a.famille === "A" && (
                                <td className="py-1.5 tabular-nums">{r.stockGros ?? 0}</td>
                              )}
                              <td className="py-1.5 tabular-nums">{dispo}</td>
                              {a.famille === "A" && (
                                <td className="py-1.5 tabular-nums">{r.reserveDetail ?? 0}</td>
                              )}
                              <td className="py-1.5 tabular-nums">{r.seuilAlerte}</td>
                              <td className="py-1.5">
                                <StockBadge qty={dispo} seuil={r.seuilAlerte} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <KitsSection kits={kits} stockableArticles={stockables} variantes={variantes} />

      {approArticle && (
        <div
          className="fixed inset-0 z-30 flex justify-end bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) setApproArticle(null);
          }}
        >
          <div className="h-full w-full max-w-md overflow-y-auto bg-background p-6 shadow-xl">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Approvisionner — {approArticle.nom}
              </h2>
              <button
                onClick={() => setApproArticle(null)}
                className="text-xl leading-none text-muted-foreground"
                aria-label="Fermer"
              >
                &times;
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Chaque approvisionnement crée un nouveau lot, tracé séparément (§8.1).
            </p>
            <div className="mt-5">
              {approArticle.famille === "A" ? (
                <ApproFamilleAForm article={approArticle} fournisseurs={fournisseurs} onDone={() => setApproArticle(null)} />
              ) : (
                <ApproFamilleBForm article={approArticle} fournisseurs={fournisseurs} onDone={() => setApproArticle(null)} />
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
