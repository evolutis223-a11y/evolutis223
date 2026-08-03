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
      <span style={{ borderRadius: 999, background: "#333", color: "#ccc", padding: "2px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
        {label ?? "Sur devis"}
      </span>
    );
  }
  if (dispo <= 0) {
    return (
      <span style={{ borderRadius: 999, background: "rgba(220,38,38,0.15)", color: "#f87171", padding: "2px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
        Rupture
      </span>
    );
  }
  return (
    <span style={{ borderRadius: 999, background: "rgba(16,185,129,0.15)", color: "#34d399", padding: "2px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
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
    <div style={{ overflow: "hidden", borderRadius: 12, border: "1px solid #333", background: "#1e1e1e" }}>
      <div className={`flex aspect-square items-center justify-center ${meta.tileClass}`} style={{ filter: "saturate(0.85) brightness(0.9)" }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={article.nom} className="h-full w-full object-cover" />
        ) : (
          <FamilleIcon id={article.famille as FamilleId} className="h-1/3 w-1/3" />
        )}
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3, color: "#fff", margin: 0 }}>{article.nom}</h3>
          <StockPill dispo={dispo} />
        </div>
        {brancheNom && <div style={{ marginTop: 2, fontSize: 11.5, color: "#888" }}>{brancheNom}</div>}
        {promo ? (
          <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#3b82f6" }}>
              {formatFcfa(prixApresPromo(Number(article.prixVente), promo))}
            </span>
            <span style={{ fontSize: 11.5, color: "#666", textDecoration: "line-through" }}>{formatFcfa(article.prixVente)}</span>
            <span style={{ borderRadius: 999, background: "rgba(59,130,246,0.15)", padding: "2px 6px", fontSize: 10, fontWeight: 700, color: "#60a5fa" }}>
              {promo.type === "POURCENTAGE" ? `-${promo.valeur}%` : `-${formatFcfa(promo.valeur)}`}
            </span>
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700, color: "#fff" }}>{formatFcfa(article.prixVente)}</div>
        )}

        {article.famille === "A" && variantesArticle.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {variantesArticle.map((v) => {
              const rupture = (v.stockDetail ?? 0) <= 0;
              const label = [v.taille, v.couleur].filter(Boolean).join(" ") || "Défaut";
              const active = v.id === selectedVarianteId;
              return (
                <button
                  key={v.id}
                  onClick={() => !rupture && setSelectedVarianteId(v.id)}
                  disabled={rupture}
                  style={{
                    borderRadius: 6,
                    border: `1px solid ${active ? "#3b82f6" : "#333"}`,
                    padding: "4px 8px",
                    fontSize: 11.5,
                    background: active ? "#3b82f6" : "transparent",
                    color: active ? "#fff" : rupture ? "#555" : "#e0e0e0",
                    textDecoration: rupture ? "line-through" : "none",
                    cursor: rupture ? "not-allowed" : "pointer",
                  }}
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
    <main style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 20px 60px" }}>
        {banniere.active && banniere.message && (
          <div style={{ marginBottom: 16, borderRadius: 8, background: "#3b82f6", padding: "10px 16px", textAlign: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>
            {banniere.message}
          </div>
        )}
        <header style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>EVOLUTIS223 — Nos produits</h1>
          <p style={{ marginTop: 4, fontSize: 13, color: "#888" }}>
            Boutique en ligne — disponibilité indicative, sujette à confirmation à la commande.
          </p>
        </header>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            onClick={() => setActiveFamille("TOUS")}
            style={{
              borderRadius: 999,
              border: `1px solid ${activeFamille === "TOUS" ? "#3b82f6" : "#333"}`,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              background: activeFamille === "TOUS" ? "#3b82f6" : "transparent",
              color: activeFamille === "TOUS" ? "#fff" : "#888",
              cursor: "pointer",
            }}
          >
            Tous ({initialArticles.length})
          </button>
          {FAMILLES.map((f) => {
            const n = initialArticles.filter((a) => a.famille === f.id).length;
            if (n === 0) return null;
            const active = activeFamille === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setActiveFamille(f.id)}
                style={{
                  borderRadius: 999,
                  border: `1px solid ${active ? "#3b82f6" : "#333"}`,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  background: active ? "#3b82f6" : "transparent",
                  color: active ? "#fff" : "#888",
                  cursor: "pointer",
                }}
              >
                {f.short} ({n})
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <p style={{ marginTop: 40, textAlign: "center", fontSize: 13, color: "#666" }}>Aucun produit publié pour l&apos;instant.</p>
        ) : (
          <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
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
      </div>
    </main>
  );
}
