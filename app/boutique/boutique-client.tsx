"use client";

import { useEffect, useState } from "react";
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

const CONTACT_TELEPHONE = "22374744082"; // EVOLUTIS223 — format wa.me (indicatif sans +)

function formatFcfa(v: string | number) {
  return `${Math.round(Number(v)).toLocaleString("fr-FR")} FCFA`;
}

function prixApresPromo(prixVente: number, promo: PromotionActive | undefined) {
  if (!promo) return prixVente;
  return promo.type === "POURCENTAGE" ? prixVente * (1 - promo.valeur / 100) : Math.max(0, prixVente - promo.valeur);
}

function lienWhatsapp(article: Article, variante?: VarianteRow) {
  const detail = variante ? [variante.taille, variante.couleur].filter(Boolean).join(" ") : "";
  const texte = `Bonjour, je suis intéressé(e) par : ${article.nom}${detail ? ` (${detail})` : ""}. Est-ce disponible ?`;
  return `https://wa.me/${CONTACT_TELEPHONE}?text=${encodeURIComponent(texte)}`;
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
  onOpen,
}: {
  article: Article;
  variantesArticle: VarianteRow[];
  kitStock?: KitStock;
  brancheNom: string | null;
  promo?: PromotionActive;
  onOpen: () => void;
}) {
  const meta = familleMeta(article.famille);
  let dispo: number | null;
  if (article.famille === "A") {
    dispo = variantesArticle.reduce((s, v) => s + (v.stockDetail ?? 0), 0);
  } else if (article.famille === "B") {
    dispo = variantesArticle[0]?.stockDetail ?? 0;
  } else if (article.famille === "E") {
    dispo = kitStock?.stockKitCalcule ?? 0;
  } else {
    dispo = null;
  }
  const photo = variantesArticle[0]?.photoUrl || article.photoUrl;
  const prixEffectif = prixApresPromo(Number(article.prixVente), promo);

  return (
    <button
      onClick={onOpen}
      style={{ textAlign: "left", overflow: "hidden", borderRadius: 14, border: "1px solid #2a2a2a", background: "#161616", cursor: "pointer", transition: "border-color 0.15s, transform 0.15s" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#444")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
    >
      <div className={`flex aspect-square items-center justify-center ${meta.tileClass}`} style={{ filter: "saturate(0.85) brightness(0.9)" }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={article.nom} className="h-full w-full object-cover" />
        ) : (
          <FamilleIcon id={article.famille as FamilleId} className="h-1/3 w-1/3" />
        )}
      </div>
      <div style={{ padding: "16px 16px 18px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35, color: "#fff", margin: 0 }}>{article.nom}</h3>
          <StockPill dispo={dispo} />
        </div>
        {brancheNom && <div style={{ marginTop: 3, fontSize: 11.5, color: "#777" }}>{brancheNom}</div>}
        {promo ? (
          <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#3b82f6" }}>{formatFcfa(prixEffectif)}</span>
            <span style={{ fontSize: 12, color: "#666", textDecoration: "line-through" }}>{formatFcfa(article.prixVente)}</span>
          </div>
        ) : (
          <div style={{ marginTop: 10, fontSize: 16, fontWeight: 700, color: "#fff" }}>{formatFcfa(article.prixVente)}</div>
        )}
      </div>
    </button>
  );
}

function DetailPanel({
  article,
  variantesArticle,
  kitStock,
  brancheNom,
  promo,
  onClose,
}: {
  article: Article;
  variantesArticle: VarianteRow[];
  kitStock?: KitStock;
  brancheNom: string | null;
  promo?: PromotionActive;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(variantesArticle[0]?.id ?? null);
  const selected = variantesArticle.find((v) => v.id === selectedId);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  let dispo: number | null;
  if (article.famille === "A") {
    dispo = selected?.stockDetail ?? 0;
  } else if (article.famille === "B") {
    dispo = variantesArticle[0]?.stockDetail ?? 0;
  } else if (article.famille === "E") {
    dispo = kitStock?.stockKitCalcule ?? 0;
  } else {
    dispo = null;
  }
  const photo = selected?.photoUrl || article.photoUrl;
  const prixEffectif = prixApresPromo(Number(article.prixVente), promo);
  const meta = familleMeta(article.famille);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.65)", display: "flex", justifyContent: "flex-end", animation: "fadeIn 0.18s ease-out" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: 460,
          maxWidth: "100vw",
          height: "100%",
          background: "#161616",
          borderLeft: "1px solid #2a2a2a",
          overflowY: "auto",
          boxSizing: "border-box",
          animation: "slideIn 0.22s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <div className={`flex aspect-[4/3] items-center justify-center ${meta.tileClass}`} style={{ position: "relative", filter: "saturate(0.85) brightness(0.9)" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={article.nom} className="h-full w-full object-cover" />
          ) : (
            <FamilleIcon id={article.famille as FamilleId} className="h-1/4 w-1/4" />
          )}
          <button
            onClick={onClose}
            style={{ position: "absolute", top: 16, right: 16, width: 34, height: 34, borderRadius: 999, border: "none", background: "rgba(10,10,10,0.65)", color: "#fff", fontSize: 18, cursor: "pointer", backdropFilter: "blur(4px)" }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: "26px 28px 40px" }}>
          {brancheNom && <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#3b82f6" }}>{brancheNom}</div>}
          <h2 style={{ marginTop: 8, fontSize: 22, fontWeight: 700, lineHeight: 1.3, color: "#fff" }}>{article.nom}</h2>

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {promo ? (
              <>
                <span style={{ fontSize: 22, fontWeight: 700, color: "#3b82f6" }}>{formatFcfa(prixEffectif)}</span>
                <span style={{ fontSize: 14, color: "#666", textDecoration: "line-through" }}>{formatFcfa(article.prixVente)}</span>
                <span style={{ borderRadius: 999, background: "rgba(59,130,246,0.15)", padding: "3px 8px", fontSize: 11, fontWeight: 700, color: "#60a5fa" }}>
                  {promo.type === "POURCENTAGE" ? `-${promo.valeur}%` : `-${formatFcfa(promo.valeur)}`}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{formatFcfa(article.prixVente)}</span>
            )}
            <StockPill dispo={dispo} />
          </div>

          {article.famille === "A" && variantesArticle.length > 0 && (
            <div style={{ marginTop: 26 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#888", marginBottom: 10 }}>Options disponibles</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {variantesArticle.map((v) => {
                  const rupture = (v.stockDetail ?? 0) <= 0;
                  const label = [v.taille, v.couleur].filter(Boolean).join(" ") || "Défaut";
                  const active = v.id === selectedId;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedId(v.id)}
                      style={{
                        borderRadius: 8,
                        border: `1px solid ${active ? "#3b82f6" : "#333"}`,
                        padding: "7px 14px",
                        fontSize: 12.5,
                        fontWeight: 600,
                        background: active ? "#3b82f6" : "transparent",
                        color: active ? "#fff" : rupture ? "#555" : "#e0e0e0",
                        textDecoration: rupture ? "line-through" : "none",
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 10 }}>
            <a
              href={lienWhatsapp(article, selected)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
                background: "#25D366", color: "#0a0a0a", fontSize: 14, fontWeight: 700, textDecoration: "none",
              }}
            >
              💬 Nous contacter sur WhatsApp
            </a>
            <a
              href={`tel:+${CONTACT_TELEPHONE}`}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: "12px 0", borderRadius: 10, border: "1px solid #333",
                color: "#e0e0e0", fontSize: 13.5, fontWeight: 600, textDecoration: "none",
              }}
            >
              📞 Appeler la boutique
            </a>
          </div>

          <p style={{ marginTop: 18, fontSize: 12, lineHeight: 1.6, color: "#666" }}>
            Disponibilité indicative — contactez-nous pour confirmer avant de vous déplacer.
          </p>
        </div>
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
  const [openArticleId, setOpenArticleId] = useState<number | null>(null);

  const brancheNom = (id: number | null) => branches.find((b) => b.id === id)?.nom ?? null;
  const promoByArticle = new Map(promotions.map((p) => [p.articleId, p]));
  const variantesByArticle = new Map<number, VarianteRow[]>();
  for (const v of variantes) {
    if (!variantesByArticle.has(v.articleId)) variantesByArticle.set(v.articleId, []);
    variantesByArticle.get(v.articleId)!.push(v);
  }
  const kitStockByArticle = new Map(kitStocks.map((k) => [k.articleId, k]));

  const filtered = activeFamille === "TOUS" ? initialArticles : initialArticles.filter((a) => a.famille === activeFamille);
  const openArticle = openArticleId != null ? initialArticles.find((a) => a.id === openArticleId) : undefined;

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideIn { from { transform: translateX(24px); opacity: 0.4 } to { transform: translateX(0); opacity: 1 } }
      `}</style>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "36px 24px 72px" }}>
        {banniere.active && banniere.message && (
          <div style={{ marginBottom: 20, borderRadius: 10, background: "#3b82f6", padding: "11px 18px", textAlign: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>
            {banniere.message}
          </div>
        )}
        <header style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3b82f6" }}>EVOLUTIS223</div>
          <h1 style={{ marginTop: 6, fontSize: 26, fontWeight: 700, color: "#fff" }}>Nos produits</h1>
          <p style={{ marginTop: 6, fontSize: 13.5, color: "#888", maxWidth: 520, lineHeight: 1.6 }}>
            Un aperçu de ce que nous fabriquons — cliquez sur un produit pour le voir en détail et nous contacter directement.
          </p>
        </header>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            onClick={() => setActiveFamille("TOUS")}
            style={{
              borderRadius: 999, border: `1px solid ${activeFamille === "TOUS" ? "#3b82f6" : "#2a2a2a"}`,
              padding: "7px 16px", fontSize: 12.5, fontWeight: 700,
              background: activeFamille === "TOUS" ? "#3b82f6" : "transparent",
              color: activeFamille === "TOUS" ? "#fff" : "#999", cursor: "pointer",
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
                  borderRadius: 999, border: `1px solid ${active ? "#3b82f6" : "#2a2a2a"}`,
                  padding: "7px 16px", fontSize: 12.5, fontWeight: 700,
                  background: active ? "#3b82f6" : "transparent",
                  color: active ? "#fff" : "#999", cursor: "pointer",
                }}
              >
                {f.short} ({n})
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <p style={{ marginTop: 60, textAlign: "center", fontSize: 13, color: "#666" }}>Aucun produit publié pour l&apos;instant.</p>
        ) : (
          <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20 }}>
            {filtered.map((a) => (
              <ProductCard
                key={a.id}
                article={a}
                variantesArticle={variantesByArticle.get(a.id) ?? []}
                kitStock={kitStockByArticle.get(a.id)}
                brancheNom={brancheNom(a.brancheId)}
                promo={promoByArticle.get(a.id)}
                onOpen={() => setOpenArticleId(a.id)}
              />
            ))}
          </div>
        )}
      </div>

      {openArticle && (
        <DetailPanel
          article={openArticle}
          variantesArticle={variantesByArticle.get(openArticle.id) ?? []}
          kitStock={kitStockByArticle.get(openArticle.id)}
          brancheNom={brancheNom(openArticle.brancheId)}
          promo={promoByArticle.get(openArticle.id)}
          onClose={() => setOpenArticleId(null)}
        />
      )}
    </main>
  );
}
