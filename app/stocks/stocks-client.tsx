"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell, type ShellModule } from "@/components/app-shell";
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

interface LotRow {
  id: number;
  articleId: number;
  dateReception: Date;
  prixAchatUnitaire: number;
  fournisseurNom: string | null;
  quantite: number;
}

const TAILLES_COURANTES = ["S", "M", "L", "XL", "XXL"];
const initialState: StockActionState = { error: null };
const initialComposantState: ComposantKitState = { error: null };

function formatFcfa(v: number) {
  return `${Math.round(v).toLocaleString("fr-FR")} FCFA`;
}
function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("fr-FR");
}

function stockStatut(qty: number, seuil: number): "rupture" | "faible" | "ok" {
  if (qty <= 0) return "rupture";
  if (qty <= seuil) return "faible";
  return "ok";
}

function StockBadge({ statut }: { statut: "rupture" | "faible" | "ok" }) {
  if (statut === "rupture") {
    return (
      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
        Rupture
      </span>
    );
  }
  if (statut === "faible") {
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: "warning" | "danger" | "success" }) {
  const color = accent === "warning" ? "text-amber-500" : accent === "danger" ? "text-rose-500" : accent === "success" ? "text-emerald-500" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1.5 text-xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function FournisseurSelect({ fournisseurs }: { fournisseurs: Fournisseur[] }) {
  if (fournisseurs.length === 0) return null;
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Fournisseur (optionnel)</label>
      <select name="fournisseurId" defaultValue="" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
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

function ApproFamilleAForm({ article, fournisseurs, onDone }: { article: Article; fournisseurs: Fournisseur[]; onDone: () => void }) {
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
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Douzaines achetées</label>
          <Input name="douzaines" type="number" min="1" value={douzaines} onChange={(e) => setDouzaines(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Couleur</label>
          <Input name="couleur" value={couleur} onChange={(e) => setCouleur(e.target.value)} placeholder="Ex. Bleu marine" required />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Répartition par taille (pour 1 douzaine)</label>
        <div className="grid grid-cols-5 gap-2">
          {TAILLES_COURANTES.map((t) => (
            <div key={t}>
              <div className="mb-1 text-center text-xs text-muted-foreground">{t}</div>
              <Input type="number" min="0" value={repartition[t] ?? ""} onChange={(e) => setRepartition((r) => ({ ...r, [t]: e.target.value }))} className="text-center" />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Total produit : <b className="text-foreground">{produitTotal} pièces</b> ({douzaines || 0} douzaine(s))
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Prix d&apos;achat unitaire</label>
          <Input name="prixAchatUnitaire" type="number" min="0" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="Ex. 6000" required />
        </div>
        <FournisseurSelect fournisseurs={fournisseurs} />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Réserve détail demandée (en PIÈCES, pas en douzaines)</label>
        <Input name="reserveDetailPieces" type="number" min="0" max={produitTotal} value={reserve} onChange={(e) => setReserve(e.target.value)} />
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">⚠ Piège fréquent : taper « 1 » réserve 1 pièce, pas 1 douzaine. Répartie automatiquement au prorata des tailles (§16.8).</p>
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-3">
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

function ApproFamilleBForm({ article, fournisseurs, onDone }: { article: Article; fournisseurs: Fournisseur[]; onDone: () => void }) {
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
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Quantité</label>
          <Input name="quantite" type="number" min="1" placeholder="Ex. 30" required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Prix d&apos;achat unitaire</label>
          <Input name="prixAchatUnitaire" type="number" min="0" placeholder="Ex. 1500" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Seuil d&apos;alerte</label>
          <Input name="seuilAlerte" type="number" min="0" placeholder="Ex. 10" />
        </div>
        <FournisseurSelect fournisseurs={fournisseurs} />
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-3">
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
        <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Composant</label>
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
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Variante exacte (§8.3 — jamais une famille entière de tailles)</label>
          <select name="varianteId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" required>
            <option value="">Choisir une variante...</option>
            {variantesDuComposant.map((v) => (
              <option key={v.id} value={v.id}>
                {v.taille || v.couleur ? `${v.taille ?? ""} ${v.couleur ?? ""}`.trim() : "Défaut"} — {composantFamille === "A" ? "gros" : "stock"}:{" "}
                {composantFamille === "A" ? v.stockGros ?? 0 : v.stockDetail ?? 0}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Quantité requise par kit</label>
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

type FamilleFiltre = "TOUS" | "A" | "B" | "E" | "ALERTES";

export function StocksClient({
  userName,
  roleLibelle,
  modules,
  articles: initialArticles,
  variantes,
  kits,
  fournisseurs,
  lots,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  articles: Article[];
  variantes: VarianteRow[];
  kits: KitData[];
  fournisseurs: Fournisseur[];
  lots: LotRow[];
}) {
  const stockables = useMemo(() => initialArticles.filter((a) => a.famille === "A" || a.famille === "B"), [initialArticles]);
  const kitByArticleId = useMemo(() => new Map(kits.map((k) => [k.article.id, k])), [kits]);
  const suivis = useMemo(() => [...stockables, ...kits.map((k) => k.article)], [stockables, kits]);

  const variantesByArticle = useMemo(() => {
    const m = new Map<number, VarianteRow[]>();
    for (const v of variantes) {
      if (!m.has(v.articleId)) m.set(v.articleId, []);
      m.get(v.articleId)!.push(v);
    }
    return m;
  }, [variantes]);

  const lotsByArticle = useMemo(() => {
    const m = new Map<number, LotRow[]>();
    for (const l of lots) {
      if (!m.has(l.articleId)) m.set(l.articleId, []);
      m.get(l.articleId)!.push(l);
    }
    return m;
  }, [lots]);

  function articleStatut(a: Article): "rupture" | "faible" | "ok" {
    if (a.famille === "E") {
      const stockKit = kitByArticleId.get(a.id)?.stock.stockKitCalcule ?? 0;
      return stockStatut(stockKit, 1);
    }
    const rows = variantesByArticle.get(a.id) ?? [];
    if (rows.length === 0) return "rupture";
    const pire = rows.reduce<"rupture" | "faible" | "ok">((acc, r) => {
      const s = stockStatut(r.stockDetail ?? 0, r.seuilAlerte);
      if (acc === "rupture" || s === "rupture") return s === "rupture" || acc === "rupture" ? "rupture" : acc;
      if (acc === "faible" || s === "faible") return "faible";
      return "ok";
    }, "ok");
    return pire;
  }

  function totalDetail(a: Article): number {
    if (a.famille === "E") return kitByArticleId.get(a.id)?.stock.stockKitCalcule ?? 0;
    const rows = variantesByArticle.get(a.id) ?? [];
    return rows.reduce((s, r) => s + (r.stockDetail ?? 0), 0);
  }

  const stats = useMemo(() => {
    let rupture = 0;
    let faible = 0;
    let valeur = 0;
    for (const a of suivis) {
      const statut = articleStatut(a);
      if (statut === "rupture") rupture++;
      if (statut === "faible") faible++;
      if (a.famille !== "E") valeur += totalDetail(a) * Number(a.pmp);
    }
    return { total: suivis.length, rupture, faible, valeur };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suivis, variantesByArticle, kitByArticleId]);

  const [filtre, setFiltre] = useState<FamilleFiltre>("TOUS");
  const [recherche, setRecherche] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(suivis[0]?.id ?? null);
  const [showAppro, setShowAppro] = useState(false);
  const [addingComposant, setAddingComposant] = useState(false);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return suivis.filter((a) => {
      if (filtre === "ALERTES" && articleStatut(a) === "ok") return false;
      if (filtre !== "TOUS" && filtre !== "ALERTES" && a.famille !== filtre) return false;
      if (!q) return true;
      return a.nom.toLowerCase().includes(q) || a.code.toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suivis, filtre, recherche, variantesByArticle, kitByArticleId]);

  const selected = suivis.find((a) => a.id === selectedId);
  const selectedKit = selected ? kitByArticleId.get(selected.id) : undefined;
  const selectedRows = selected ? variantesByArticle.get(selected.id) ?? [] : [];
  const selectedLots = selected ? (lotsByArticle.get(selected.id) ?? []).slice(0, 6) : [];

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Stocks" modules={modules}>
      <div className="flex h-full min-h-0 flex-col gap-4 p-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Stocks</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Familles A (textile/douzaine) et B (unité) approvisionnées directement ici, chaque entrée trace un lot. Famille E (kits) recalculée depuis sa recette — pas de saisie directe.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Articles suivis" value={String(stats.total)} />
          <Stat label="En rupture" value={String(stats.rupture)} accent="danger" />
          <Stat label="Stock faible" value={String(stats.faible)} accent="warning" />
          <Stat label="Valeur du stock (PMP)" value={formatFcfa(stats.valeur)} accent="success" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {([
              ["TOUS", `Tous (${suivis.length})`],
              ["A", `A · Textile (${suivis.filter((a) => a.famille === "A").length})`],
              ["B", `B · Unité (${suivis.filter((a) => a.famille === "B").length})`],
              ["E", `E · Kits (${suivis.filter((a) => a.famille === "E").length})`],
              ["ALERTES", `⚠ Alertes (${stats.rupture + stats.faible})`],
            ] as [FamilleFiltre, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFiltre(key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filtre === key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <Input placeholder="Rechercher un article..." value={recherche} onChange={(e) => setRecherche(e.target.value)} className="h-9 w-56" />
        </div>

        <div className="flex min-h-0 flex-1 gap-4">
          <div className="flex w-80 flex-shrink-0 flex-col gap-2 overflow-y-auto">
            {filtres.length === 0 && <p className="rounded-md border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">Aucun article.</p>}
            {filtres.map((a) => {
              const statut = articleStatut(a);
              const dispo = totalDetail(a);
              return (
                <button
                  key={a.id}
                  onClick={() => {
                    setSelectedId(a.id);
                    setShowAppro(false);
                  }}
                  className={`rounded-lg border p-3 text-left transition-colors ${a.id === selectedId ? "border-primary bg-primary/10" : "border-border bg-card hover:border-border/70"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{a.nom}</div>
                      <div className="font-mono text-[10.5px] text-muted-foreground">{a.code}</div>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground">{a.famille}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {a.famille === "E" ? `${dispo} kit(s) possible(s)` : `${dispo} pièce(s) dispo`}
                    </span>
                    <StockBadge statut={statut} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="min-w-0 flex-1 overflow-y-auto rounded-xl border border-border bg-card p-6">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Cliquez un article à gauche pour voir sa fiche.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <div className="text-lg font-bold text-foreground">{selected.nom}</div>
                    <div className="mt-0.5 font-mono text-xs text-muted-foreground">{selected.code}</div>
                  </div>
                  {selected.famille !== "E" && (
                    <Button size="sm" onClick={() => setShowAppro((s) => !s)}>
                      {showAppro ? "Annuler" : "+ Approvisionner"}
                    </Button>
                  )}
                </div>

                {selected.famille === "E" ? (
                  <>
                    <div className="mt-4 flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        Stock calculé : <b className="text-foreground tabular-nums">{selectedKit?.stock.stockKitCalcule ?? 0}</b>
                      </span>
                      <StockBadge statut={stockStatut(selectedKit?.stock.stockKitCalcule ?? 0, 1)} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Jamais de quantité saisie directement — recalculé depuis la recette, goulot d&apos;étranglement sur le composant/variante le plus limitant (stock gros pour un composant Famille A, réserve détail toujours exclue, §8.3 point 4).
                    </p>

                    {selectedKit?.stock.composantLimitant && (
                      <p className="mt-3 rounded-md border-l-2 border-amber-500 bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Composant limitant : variante {selectedKit.stock.composantLimitant.varianteId} — {selectedKit.stock.composantLimitant.stockVariante} disponible ÷{" "}
                        {selectedKit.stock.composantLimitant.quantiteRequise} requis = {selectedKit.stock.composantLimitant.stockPossible} kit(s) possible(s).
                      </p>
                    )}

                    <div className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recette</div>
                    {(selectedKit?.recette.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun composant — recette vide, aucune vente possible.</p>
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
                          {selectedKit?.recette.map((r) => (
                            <tr key={r.id} className="border-t border-border">
                              <td className="py-1.5">{r.composantNom}</td>
                              <td className="py-1.5">{r.taille || r.couleur ? `${r.taille ?? ""} ${r.couleur ?? ""}`.trim() : "Défaut"}</td>
                              <td className="py-1.5 tabular-nums">{r.quantiteRequise}</td>
                              <td className="py-1.5 text-right">
                                <button onClick={() => retirerComposantKit(r.id)} className="text-xs text-destructive hover:underline">
                                  Retirer
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {addingComposant ? (
                      <AjouterComposantForm kitArticleId={selected.id} stockableArticles={stockables} variantes={variantes} onDone={() => setAddingComposant(false)} />
                    ) : (
                      <Button size="sm" variant="outline" className="mt-3" onClick={() => setAddingComposant(true)}>
                        + Ajouter un composant
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vue d&apos;ensemble par variante</div>
                    {selectedRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Pas encore de stock enregistré.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase text-muted-foreground">
                            <th className="py-1.5">Variante</th>
                            {selected.famille === "A" && <th className="py-1.5">Gros</th>}
                            <th className="py-1.5">Détail dispo.</th>
                            {selected.famille === "A" && <th className="py-1.5">Réservé</th>}
                            <th className="py-1.5">Seuil</th>
                            <th className="py-1.5"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRows.map((r) => {
                            const dispo = r.stockDetail ?? 0;
                            return (
                              <tr key={r.id} className="border-t border-border">
                                <td className="py-1.5">{r.taille || r.couleur ? `${r.taille ?? ""} ${r.couleur ?? ""}`.trim() : "Défaut"}</td>
                                {selected.famille === "A" && <td className="py-1.5 tabular-nums">{r.stockGros ?? 0}</td>}
                                <td className="py-1.5 tabular-nums">{dispo}</td>
                                {selected.famille === "A" && <td className="py-1.5 tabular-nums">{r.reserveDetail ?? 0}</td>}
                                <td className="py-1.5 tabular-nums">{r.seuilAlerte}</td>
                                <td className="py-1.5">
                                  <StockBadge statut={stockStatut(dispo, r.seuilAlerte)} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}

                    <div className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Historique des lots (traçabilité)</div>
                    {selectedLots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun lot reçu pour l&apos;instant.</p>
                    ) : (
                      <div>
                        {selectedLots.map((l) => (
                          <div key={l.id} className="flex items-center justify-between border-t border-border py-2 text-xs first:border-t-0">
                            <span className="text-foreground">
                              Lot #{l.id} — {l.quantite} pièce(s)
                            </span>
                            <span className="text-muted-foreground">
                              {formatDate(l.dateReception)} · PA {formatFcfa(l.prixAchatUnitaire)} · {l.fournisseurNom ?? "Sans fournisseur"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {showAppro && (
                      <div className="mt-5 rounded-lg border border-dashed border-border p-4">
                        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nouvel approvisionnement</div>
                        <p className="mb-3 text-xs text-muted-foreground">Chaque approvisionnement crée un nouveau lot, tracé séparément (§8.1).</p>
                        {selected.famille === "A" ? (
                          <ApproFamilleAForm article={selected} fournisseurs={fournisseurs} onDone={() => setShowAppro(false)} />
                        ) : (
                          <ApproFamilleBForm article={selected} fournisseurs={fournisseurs} onDone={() => setShowAppro(false)} />
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
