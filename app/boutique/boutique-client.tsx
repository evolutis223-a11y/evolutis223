"use client";

import { useMemo, useState } from "react";
import type { articles, branches } from "@/db/schema";
import { FAMILLES, FamilleIcon, familleMeta, type FamilleId } from "@/app/catalogue/familles";

type Article = typeof articles.$inferSelect;
type Branche = typeof branches.$inferSelect;
interface VarianteRow {
  id: number;
  articleId: number;
  taille: string | null;
  couleur: string | null;
  photoUrl: string | null;
  stockDetail: number | null;
}
interface KitStock {
  articleId: number;
  stockKitCalcule: number;
}
interface PromotionActive {
  articleId: number;
  type: string;
  valeur: number;
}

function formatFcfa(v: string | number) {
  return `${Math.round(Number(v)).toLocaleString("fr-FR")} F`;
}

function prixApresPromo(prixVente: number, promo: PromotionActive | undefined) {
  if (!promo) return prixVente;
  return promo.type === "POURCENTAGE" ? prixVente * (1 - promo.valeur / 100) : Math.max(0, prixVente - promo.valeur);
}

function StockPill({ dispo, label }: { dispo: number | null; label?: string }) {
  if (dispo === null) {
    return (
      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
        {label ?? "Sur devis"}
      </span>
    );
  }
  if (dispo <= 0) {
    return (
      <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
        Rupture
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
      En stock
    </span>
  );
}

function ProductCard({
  article,
  variantesArticle,
  kitStock,
  brancheNom,
  promo,
}: {
  article: Article;
  variantesArticle: VarianteRow[];
  kitStock?: KitStock;
  brancheNom: string | null;
  promo?: PromotionActive;
}) {
  const meta = familleMeta(article.famille);
  const [selectedVarianteId, setSelectedVarianteId] = useState<number | null>(
    variantesArticle[0]?.id ?? null
  );
  const selected = variantesArticle.find((v) => v.id === selectedVarianteId);

  let dispo: number | null;
  if (article.famille === "A") {
    dispo = selected?.stockDetail ?? 0;
  } else if (article.famille === "B") {
    dispo = variantesArticle[0]?.stockDetail ?? 0;
  } else if (article.famille === "E") {
    dispo = kitStock?.stockKitCalcule ?? 0;
  } else {
    dispo = null; // C, D : service / sur commande, pas de notion de stock
  }

  const photo = selected?.photoUrl || article.photoUrl;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className={`flex aspect-square items-center justify-center ${meta.tileClass}`}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={article.nom} className="h-full w-full object-cover" />
        ) : (
          <FamilleIcon id={article.famille as FamilleId} className="h-1/3 w-1/3" />
        )}
      </div>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug text-card-foreground">{article.nom}</h3>
          <StockPill dispo={dispo} />
        </div>
        {brancheNom && <div className="mt-0.5 text-xs text-muted-foreground">{brancheNom}</div>}
        {promo ? (
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-base font-semibold tabular-nums text-primary">
              {formatFcfa(prixApresPromo(Number(article.prixVente), promo))}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground line-through">{formatFcfa(article.prixVente)}</span>
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              {promo.type === "POURCENTAGE" ? `-${promo.valeur}%` : `-${formatFcfa(promo.valeur)}`}
            </span>
          </div>
        ) : (
          <div className="mt-2 text-base font-semibold tabular-nums text-foreground">
            {formatFcfa(article.prixVente)}
          </div>
        )}

        {article.famille === "A" && variantesArticle.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {variantesArticle.map((v) => {
              const rupture = (v.stockDetail ?? 0) <= 0;
              const label = [v.taille, v.couleur].filter(Boolean).join(" ") || "Défaut";
              return (
                <button
                  key={v.id}
                  onClick={() => !rupture && setSelectedVarianteId(v.id)}
                  disabled={rupture}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    v.id === selectedVarianteId
                      ? "border-primary bg-primary text-primary-foreground"
                      : rupture
                        ? "cursor-not-allowed border-border text-muted-foreground/50 line-through"
                        : "border-border text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function BoutiqueClient({
  articles: initialArticles,
  variantes,
  branches,
  kitStocks,
  promotions,
  banniere,
}: {
  articles: Article[];
  variantes: VarianteRow[];
  branches: Branche[];
  kitStocks: KitStock[];
  promotions: PromotionActive[];
  banniere: { message: string | null; active: boolean };
}) {
  const [activeFamille, setActiveFamille] = useState<FamilleId | "TOUS">("TOUS");
  const brancheNom = (id: number | null) => branches.find((b) => b.id === id)?.nom ?? null;
  const promoByArticle = useMemo(() => new Map(promotions.map((p) => [p.articleId, p])), [promotions]);

  const variantesByArticle = useMemo(() => {
    const m = new Map<number, VarianteRow[]>();
    for (const v of variantes) {
      if (!m.has(v.articleId)) m.set(v.articleId, []);
      m.get(v.articleId)!.push(v);
    }
    return m;
  }, [variantes]);

  const kitStockByArticle = useMemo(() => new Map(kitStocks.map((k) => [k.articleId, k])), [kitStocks]);

  const filtered = useMemo(
    () =>
      activeFamille === "TOUS" ? initialArticles : initialArticles.filter((a) => a.famille === activeFamille),
    [initialArticles, activeFamille]
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {banniere.active && banniere.message && (
        <div className="mb-4 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground">
          {banniere.message}
        </div>
      )}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">EVOLUTIS223 — Nos produits</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Boutique en ligne — disponibilité indicative, sujette à confirmation à la commande.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveFamille("TOUS")}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
            activeFamille === "TOUS"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground"
          }`}
        >
          Tous ({initialArticles.length})
        </button>
        {FAMILLES.map((f) => {
          const n = initialArticles.filter((a) => a.famille === f.id).length;
          if (n === 0) return null;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFamille(f.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                activeFamille === f.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              {f.short} ({n})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Aucun produit publié pour l&apos;instant.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {filtered.map((a) => (
            <ProductCard
              key={a.id}
              article={a}
              variantesArticle={variantesByArticle.get(a.id) ?? []}
              kitStock={kitStockByArticle.get(a.id)}
              brancheNom={brancheNom(a.brancheId)}
              promo={promoByArticle.get(a.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
