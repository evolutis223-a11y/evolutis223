"use client";

import { useMemo, useState } from "react";
import type { articles, branches } from "@/db/schema";
import { FAMILLES, FamilleIcon, familleMeta, type FamilleId } from "@/app/catalogue/familles";
import { passerCommandeBoutique, type PanierLigne } from "./actions";

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
interface CartItem {
  key: string;
  articleId: number;
  varianteId: number;
  nom: string;
  prixUnitaire: number;
  qte: number;
  maxDispo: number;
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
  qteDejaAuPanier,
  onAdd,
}: {
  article: Article;
  variantesArticle: VarianteRow[];
  kitStock?: KitStock;
  brancheNom: string | null;
  promo?: PromotionActive;
  qteDejaAuPanier: (varianteId: number) => number;
  onAdd: (item: { articleId: number; varianteId: number; nom: string; prixUnitaire: number; maxDispo: number }) => void;
}) {
  const meta = familleMeta(article.famille);
  const [selectedVarianteId, setSelectedVarianteId] = useState<number | null>(variantesArticle[0]?.id ?? null);
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
  const prixEffectif = prixApresPromo(Number(article.prixVente), promo);

  // Commande en ligne limitée aux familles A/B (stock simple, un décrément FIFO standard) — les
  // kits (E) ont une logique de décrément dédiée (calculerStockKit/decrementerKit, app/stocks) non
  // branchée sur creerAffaireInterne, et C/D sont du sur-mesure/service : on renvoie au contact
  // plutôt que de fabriquer une commande en ligne qui ne déclencherait pas le bon flux de stock.
  const commandable = (article.famille === "A" || article.famille === "B") && selected && dispo !== null && dispo > 0;
  const dejaAuPanier = selected ? qteDejaAuPanier(selected.id) : 0;
  const resteDispo = dispo !== null ? dispo - dejaAuPanier : 0;

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
            <span style={{ fontSize: 15, fontWeight: 700, color: "#3b82f6" }}>{formatFcfa(prixEffectif)}</span>
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

        <button
          disabled={!commandable || resteDispo <= 0}
          onClick={() =>
            selected &&
            onAdd({ articleId: article.id, varianteId: selected.id, nom: article.nom, prixUnitaire: prixEffectif, maxDispo: dispo ?? 0 })
          }
          style={{
            marginTop: 12,
            width: "100%",
            padding: "9px 0",
            borderRadius: 8,
            border: "none",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: commandable && resteDispo > 0 ? "pointer" : "not-allowed",
            background: commandable && resteDispo > 0 ? "#3b82f6" : "#262626",
            color: commandable && resteDispo > 0 ? "#fff" : "#666",
          }}
        >
          {commandable ? (resteDispo > 0 ? (dejaAuPanier > 0 ? `+ Ajouter (${dejaAuPanier} au panier)` : "+ Ajouter au panier") : "Épuisé dans le panier") : "Nous contacter"}
        </button>
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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [mode, setMode] = useState<"RETRAIT" | "LIVRAISON">("RETRAIT");
  const [adresse, setAdresse] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ numero: string } | null>(null);

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
    () => (activeFamille === "TOUS" ? initialArticles : initialArticles.filter((a) => a.famille === activeFamille)),
    [initialArticles, activeFamille]
  );

  function qteDejaAuPanier(varianteId: number) {
    return cart.find((c) => c.varianteId === varianteId)?.qte ?? 0;
  }

  function handleAdd(item: { articleId: number; varianteId: number; nom: string; prixUnitaire: number; maxDispo: number }) {
    setCart((prev) => {
      const existant = prev.find((c) => c.varianteId === item.varianteId);
      if (existant) {
        if (existant.qte >= item.maxDispo) return prev;
        return prev.map((c) => (c.varianteId === item.varianteId ? { ...c, qte: c.qte + 1 } : c));
      }
      return [...prev, { key: `${item.articleId}-${item.varianteId}`, articleId: item.articleId, varianteId: item.varianteId, nom: item.nom, prixUnitaire: item.prixUnitaire, qte: 1, maxDispo: item.maxDispo }];
    });
    setCartOpen(true);
  }

  function updateQte(varianteId: number, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.varianteId === varianteId ? { ...c, qte: Math.min(c.maxDispo, Math.max(0, c.qte + delta)) } : c))
        .filter((c) => c.qte > 0)
    );
  }

  const totalPanier = cart.reduce((acc, c) => acc + c.qte * c.prixUnitaire, 0);
  const nbArticles = cart.reduce((acc, c) => acc + c.qte, 0);

  async function submitCommande() {
    setError(null);
    if (!nom.trim() || !telephone.trim()) return setError("Nom et téléphone requis.");
    if (mode === "LIVRAISON" && !adresse.trim()) return setError("Adresse de livraison requise.");
    setPending(true);
    const lignes: PanierLigne[] = cart.map((c) => ({ articleId: c.articleId, varianteId: c.varianteId, quantite: c.qte, prixUnitaire: c.prixUnitaire }));
    const res = await passerCommandeBoutique(nom.trim(), telephone.trim(), lignes, mode, mode === "LIVRAISON" ? adresse.trim() : null);
    setPending(false);
    if (res.error) return setError(res.error);
    setConfirmation({ numero: res.numero ?? "" });
    setCart([]);
    setCheckoutOpen(false);
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", paddingBottom: cart.length > 0 ? 76 : 0 }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 20px 60px" }}>
        {banniere.active && banniere.message && (
          <div style={{ marginBottom: 16, borderRadius: 8, background: "#3b82f6", padding: "10px 16px", textAlign: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>
            {banniere.message}
          </div>
        )}
        <header style={{ marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>EVOLUTIS223 — Nos produits</h1>
            <p style={{ marginTop: 4, fontSize: 13, color: "#888" }}>
              Boutique en ligne — disponibilité indicative, sujette à confirmation à la commande.
            </p>
          </div>
          <button
            onClick={() => setCartOpen(true)}
            style={{ flexShrink: 0, position: "relative", background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: "8px 14px", color: "#e0e0e0", fontSize: 13, cursor: "pointer" }}
          >
            🛒 Panier{nbArticles > 0 ? ` (${nbArticles})` : ""}
          </button>
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
                qteDejaAuPanier={qteDejaAuPanier}
                onAdd={handleAdd}
              />
            ))}
          </div>
        )}
      </div>

      {/* Barre panier fixe */}
      {cart.length > 0 && !cartOpen && !checkoutOpen && !confirmation && (
        <div
          onClick={() => setCartOpen(true)}
          style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#1e1e1e", borderTop: "1px solid #333", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        >
          <span style={{ fontSize: 13, color: "#e0e0e0" }}>{nbArticles} article(s) — {formatFcfa(totalPanier)}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#3b82f6" }}>Voir le panier →</span>
        </div>
      )}

      {/* Drawer panier */}
      {cartOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "flex-end" }} onClick={(e) => e.target === e.currentTarget && setCartOpen(false)}>
          <div style={{ width: 380, maxWidth: "92vw", height: "100%", background: "#1e1e1e", borderLeft: "1px solid #333", padding: 20, overflowY: "auto", boxSizing: "border-box" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Votre panier</div>
              <button onClick={() => setCartOpen(false)} style={{ background: "none", border: "none", color: "#888", fontSize: 20, cursor: "pointer" }}>
                &times;
              </button>
            </div>
            {cart.length === 0 ? (
              <p style={{ fontSize: 13, color: "#666" }}>Panier vide.</p>
            ) : (
              <>
                {cart.map((c) => (
                  <div key={c.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #262626" }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#e0e0e0" }}>{c.nom}</div>
                      <div style={{ fontSize: 11.5, color: "#888" }}>{formatFcfa(c.prixUnitaire)} × {c.qte}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => updateQte(c.varianteId, -1)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #333", background: "none", color: "#e0e0e0", cursor: "pointer" }}>
                        −
                      </button>
                      <span style={{ fontSize: 13, color: "#fff", minWidth: 16, textAlign: "center" }}>{c.qte}</span>
                      <button
                        onClick={() => updateQte(c.varianteId, 1)}
                        disabled={c.qte >= c.maxDispo}
                        style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #333", background: "none", color: c.qte >= c.maxDispo ? "#444" : "#e0e0e0", cursor: c.qte >= c.maxDispo ? "not-allowed" : "pointer" }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: "#fff" }}>
                  <span>Total</span>
                  <span>{formatFcfa(totalPanier)}</span>
                </div>
                <button
                  onClick={() => {
                    setCartOpen(false);
                    setCheckoutOpen(true);
                  }}
                  style={{ marginTop: 16, width: "100%", padding: "12px 0", borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                >
                  Commander
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Checkout */}
      {checkoutOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={(e) => e.target === e.currentTarget && setCheckoutOpen(false)}>
          <div style={{ width: 420, maxWidth: "92vw", background: "#1e1e1e", border: "1px solid #333", borderRadius: 10, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Finaliser la commande</div>
              <button onClick={() => setCheckoutOpen(false)} style={{ background: "none", border: "none", color: "#888", fontSize: 20, cursor: "pointer" }}>
                &times;
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} style={{ background: "#121212", border: "1px solid #333", color: "#e0e0e0", padding: "10px 12px", borderRadius: 8, fontSize: 14 }} />
              <input placeholder="Téléphone" value={telephone} onChange={(e) => setTelephone(e.target.value)} style={{ background: "#121212", border: "1px solid #333", color: "#e0e0e0", padding: "10px 12px", borderRadius: 8, fontSize: 14 }} />
              <select value={mode} onChange={(e) => setMode(e.target.value as "RETRAIT" | "LIVRAISON")} style={{ background: "#121212", border: "1px solid #333", color: "#e0e0e0", padding: "10px 12px", borderRadius: 8, fontSize: 14 }}>
                <option value="RETRAIT">Retrait en boutique</option>
                <option value="LIVRAISON">Livraison</option>
              </select>
              {mode === "LIVRAISON" && (
                <input placeholder="Adresse de livraison" value={adresse} onChange={(e) => setAdresse(e.target.value)} style={{ background: "#121212", border: "1px solid #333", color: "#e0e0e0", padding: "10px 12px", borderRadius: 8, fontSize: 14 }} />
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: "#fff", borderTop: "1px solid #333", paddingTop: 10 }}>
                <span>Total</span>
                <span>{formatFcfa(totalPanier)}</span>
              </div>
              {error && <p style={{ fontSize: 12.5, color: "#f87171", margin: 0 }}>{error}</p>}
              <button
                disabled={pending}
                onClick={submitCommande}
                style={{ marginTop: 4, width: "100%", padding: "12px 0", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                {pending ? "Envoi..." : "Confirmer la commande"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation */}
      {confirmation && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setConfirmation(null)}>
          <div style={{ width: 380, maxWidth: "92vw", background: "#1e1e1e", border: "1px solid #10b981", borderRadius: 10, padding: 28, textAlign: "center" }}>
            <div style={{ fontSize: 32 }}>✅</div>
            <div style={{ marginTop: 10, fontSize: 16, fontWeight: 700, color: "#fff" }}>Commande enregistrée</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "#888" }}>
              Numéro : <span style={{ color: "#e0e0e0", fontWeight: 700 }}>{confirmation.numero}</span>
            </div>
            <p style={{ marginTop: 10, fontSize: 12, color: "#666" }}>Nous vous contacterons pour confirmer la disponibilité et la finalisation.</p>
            <button onClick={() => setConfirmation(null)} style={{ marginTop: 14, padding: "9px 20px", borderRadius: 8, border: "1px solid #333", background: "none", color: "#e0e0e0", fontSize: 13, cursor: "pointer" }}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
