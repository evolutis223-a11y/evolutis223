"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { articles, branches } from "@/db/schema";
import { enregistrerContenuNosProduits, type NosProduitsContenu } from "./actions";

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
interface Banniere {
  message: string | null;
  active: boolean;
}

const CONTACT_TELEPHONE = "22378983849";
const FAMILLE_GLYPH: Record<string, string> = { A: "👕", B: "☕", C: "🎨", D: "💻", E: "🎁" };

function formatFcfa(v: string | number) {
  return `${Math.round(Number(v)).toLocaleString("fr-FR")} FCFA`;
}
function prixApresPromo(prixVente: number, promo: PromotionActive | undefined) {
  if (!promo) return prixVente;
  return promo.type === "POURCENTAGE" ? prixVente * (1 - promo.valeur / 100) : Math.max(0, prixVente - promo.valeur);
}
function lienWhatsapp(nom: string) {
  const texte = `Bonjour, je suis intéressé(e) par : ${nom}. Est-ce disponible ?`;
  return `https://wa.me/${CONTACT_TELEPHONE}?text=${encodeURIComponent(texte)}`;
}

interface Produit {
  article: Article;
  brancheNom: string | null;
  photos: string[];
  glyph: string;
  dispo: number | null;
  prixEffectif: number;
  promo?: PromotionActive;
  grande: boolean;
}

function calculerDispo(article: Article, variantesArticle: VarianteRow[], kitStock?: KitStock): number | null {
  if (article.famille === "A") return variantesArticle.reduce((s, v) => s + (v.stockDetail ?? 0), 0);
  if (article.famille === "B") return variantesArticle[0]?.stockDetail ?? 0;
  if (article.famille === "E") return kitStock?.stockKitCalcule ?? 0;
  return null;
}

export function NosProduitsClient({
  articles: articleRows,
  variantes: varianteRows,
  branches: brancheRows,
  kitStocks,
  promotions,
  banniere,
  contenu: contenuInitial,
  estAdmin,
  estConnecte,
}: {
  articles: Article[];
  variantes: VarianteRow[];
  branches: Branche[];
  kitStocks: KitStock[];
  promotions: PromotionActive[];
  banniere: Banniere;
  contenu: NosProduitsContenu;
  estAdmin: boolean;
  estConnecte: boolean;
}) {
  const router = useRouter();
  const produits: Produit[] = articleRows.map((article, i) => {
    const variantesArticle = varianteRows.filter((v) => v.articleId === article.id);
    const branche = brancheRows.find((b) => b.id === article.brancheId);
    const kitStock = kitStocks.find((k) => k.articleId === article.id);
    const promo = promotions.find((p) => p.articleId === article.id);
    const photos = Array.from(new Set([article.photoUrl, ...variantesArticle.map((v) => v.photoUrl)].filter((u): u is string => !!u)));
    return {
      article,
      brancheNom: branche?.nom ?? null,
      photos,
      glyph: FAMILLE_GLYPH[article.famille] ?? "🛍️",
      dispo: calculerDispo(article, variantesArticle, kitStock),
      prixEffectif: prixApresPromo(Number(article.prixVente), promo),
      promo,
      grande: i % 4 === 0 || i % 4 === 3,
    };
  });

  // ---------------- BANDEAU ----------------
  const bannerMessages =
    banniere.active && banniere.message
      ? [banniere.message]
      : ["Bienvenue sur le présentoir EVOLUTIS223", "Écrivez-nous sur WhatsApp pour toute question"];
  const [bIdx, setBIdx] = useState(0);
  useEffect(() => {
    if (bannerMessages.length <= 1) return;
    const t = setInterval(() => setBIdx((i) => (i + 1) % bannerMessages.length), 4200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bannerMessages.length]);
  // ---------------- RÉGLAGES PERSISTÉS (bandeau, dégradé) ----------------
  const [contenu, setContenu] = useState(contenuInitial);
  function majReglage<K extends keyof NosProduitsContenu>(cle: K, valeur: NosProduitsContenu[K]) {
    const suivant = { ...contenu, [cle]: valeur };
    setContenu(suivant);
    enregistrerContenuNosProduits(suivant);
  }

  // ---------------- MODE D'AFFICHAGE ----------------
  const [vue, setVue] = useState<"grille" | "galerie" | "liste">("grille");
  const [galerieIdx, setGalerieIdx] = useState(0);
  const [galerieSens, setGalerieSens] = useState<1 | -1>(1);

  // ---------------- VISIONNEUSE PLEIN ÉCRAN ----------------
  const [ouvertIdx, setOuvertIdx] = useState<number | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [viewerSens, setViewerSens] = useState<1 | -1>(1);
  const produitOuvert = ouvertIdx !== null ? produits[ouvertIdx] : null;

  function ouvrir(i: number) {
    setOuvertIdx(i);
    setImgIdx(0);
  }
  function avancerViewer(d: 1 | -1) {
    if (ouvertIdx === null) return;
    const p = produits[ouvertIdx];
    setViewerSens(d);
    if (p.photos.length > 1) {
      const next = imgIdx + d;
      if (next >= 0 && next < p.photos.length) {
        setImgIdx(next);
        return;
      }
    }
    setOuvertIdx((ouvertIdx + d + produits.length) % produits.length);
    setImgIdx(0);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (ouvertIdx === null) return;
      if (e.key === "Escape") setOuvertIdx(null);
      if (e.key === "ArrowLeft") avancerViewer(-1);
      if (e.key === "ArrowRight") avancerViewer(1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvertIdx, imgIdx]);

  // ---------------- MODE PANORAMA AUTOMATIQUE (galerie, inactivité) ----------------
  const [panorama, setPanorama] = useState(false);
  const attenteRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boucleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  function arreterPanoramaMinuteur() {
    if (attenteRef.current) clearTimeout(attenteRef.current);
    if (boucleRef.current) clearInterval(boucleRef.current);
    attenteRef.current = null;
    boucleRef.current = null;
    setPanorama(false);
  }
  function demarrerPanoramaMinuteur() {
    arreterPanoramaMinuteur();
    attenteRef.current = setTimeout(() => {
      setPanorama(true);
      boucleRef.current = setInterval(() => {
        setGalerieSens(1);
        setGalerieIdx((i) => (i + 1) % produits.length);
      }, 2600);
    }, 6000);
  }
  useEffect(() => {
    if (vue === "galerie") demarrerPanoramaMinuteur();
    else arreterPanoramaMinuteur();
    return arreterPanoramaMinuteur;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vue]);
  function sortirPanorama() {
    if (vue === "galerie") demarrerPanoramaMinuteur();
  }

  // ---------------- ADMIN ----------------
  const [adminOuvert, setAdminOuvert] = useState(false);
  const [gestionOuvert, setGestionOuvert] = useState(false);
  const [gestionPlein, setGestionPlein] = useState(false);

  const produitGalerie = produits[galerieIdx];
  const bannerNode = (
    <div className={`banner${contenu.bannerTaille === "grande" ? " grand" : ""}`}>
      <b>Info</b> · {bannerMessages[bIdx]}
    </div>
  );

  return (
    <div className="np-root">
      <style dangerouslySetInnerHTML={{ __html: NOS_PRODUITS_CSS }} />

      {estConnecte ? (
        <button className="nav-toggle" onClick={() => router.back()} title="Retour">
          ←
        </button>
      ) : (
        <button className="nav-toggle" onClick={() => window.close()} title="Fermer">
          ✕
        </button>
      )}

      {estAdmin && (
        <>
          <button className="admin-toggle" onClick={() => setAdminOuvert((v) => !v)} title="Menu admin">
            ☰
          </button>
          <div className={`admin-scrim${adminOuvert ? " open" : ""}`} onClick={() => setAdminOuvert(false)} />
          <div className={`admin-menu${adminOuvert ? " open" : ""}`}>
            <h4>Nos produits</h4>
            <div className="sous">Menu admin — visible par rôle</div>
            <div className="admin-group">
              <div className="titre">Réglages rapides</div>
              <div className="admin-row">
                Bandeau publicitaire
                <button className={`sw${contenu.bannerActif ? " on" : ""}`} onClick={() => majReglage("bannerActif", !contenu.bannerActif)}>
                  <span className="knob" />
                </button>
              </div>
              <div className="admin-row">
                Position du bandeau
                <button
                  className={`sw${contenu.bannerPosition === "bas" ? " on" : ""}`}
                  onClick={() => majReglage("bannerPosition", contenu.bannerPosition === "haut" ? "bas" : "haut")}
                  title="Haut / Bas"
                >
                  <span className="knob" />
                </button>
              </div>
              <div className="admin-row">
                Grande taille du bandeau
                <button
                  className={`sw${contenu.bannerTaille === "grande" ? " on" : ""}`}
                  onClick={() => majReglage("bannerTaille", contenu.bannerTaille === "fine" ? "grande" : "fine")}
                >
                  <span className="knob" />
                </button>
              </div>
              <div className="admin-row">
                Dégradés sur les vignettes
                <button className={`sw${contenu.degradeActif ? " on" : ""}`} onClick={() => majReglage("degradeActif", !contenu.degradeActif)}>
                  <span className="knob" />
                </button>
              </div>
            </div>
            <div className="admin-group">
              <div className="titre">Raccourcis</div>
              <Link className="admin-shortcut" href="/parametres">
                ⚙ Réglages avancés (Paramètres) <span className="arrow">→</span>
              </Link>
              <Link className="admin-shortcut" href="/commercial">
                👥 Commerciaux &amp; rôles (Commercial) <span className="arrow">→</span>
              </Link>
              <Link className="admin-shortcut" href="/rapports">
                📊 Chiffre d&apos;affaires (Rapports) <span className="arrow">→</span>
              </Link>
              <Link className="admin-shortcut" href="/catalogue">
                📦 Gérer les produits (Catalogue) <span className="arrow">→</span>
              </Link>
            </div>
            <button
              className="admin-manage-btn"
              onClick={() => {
                setAdminOuvert(false);
                setGestionOuvert(true);
              }}
            >
              Ouvrir la gestion complète →
            </button>
          </div>

          <div className={`manage-panel${gestionOuvert ? " open" : ""}${gestionPlein ? " full" : ""}`}>
            <div className="manage-head">
              <h3>Gestion — Nos produits</h3>
              <div className="manage-head-btns">
                <button onClick={() => setGestionPlein((v) => !v)} title="Agrandir">
                  ⤢
                </button>
                <button
                  onClick={() => {
                    setGestionOuvert(false);
                    setGestionPlein(false);
                  }}
                  title="Fermer"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="manage-body">
              <div className="manage-card">
                <div className="titre">Liens &amp; accès partagés</div>
                <div className="note" style={{ marginTop: 6 }}>
                  Chaque commercial a son lien nominatif (page Commercial → « Mon lien de parrainage »), utilisable sans compte. Les visites sont comptabilisées.
                </div>
                <Link className="lien" href="/commercial">
                  Voir dans Commercial →
                </Link>
              </div>
              <div className="manage-card">
                <div className="titre">Commerciaux &amp; chiffre d&apos;affaires généré</div>
                <div className="note" style={{ marginTop: 6 }}>
                  L&apos;attribution automatique d&apos;une vente à un lien viendra avec le futur système de commande. En attendant, consulte Commercial et Rapports directement.
                </div>
                <Link className="lien" href="/rapports">
                  Voir Rapports →
                </Link>
              </div>
              <div className="manage-card">
                <div className="titre">Produits affichés</div>
                <div className="valeur">{produits.length}</div>
                <div className="note">Publiés via Catalogue (case &laquo; Publier sur la boutique &raquo;)</div>
                <Link className="lien" href="/catalogue">
                  Ouvrir Catalogue →
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {contenu.bannerActif && contenu.bannerPosition === "haut" && bannerNode}

      <div className="topbar">
        <div className="mark">
          E<b>223</b>
        </div>
      </div>

      <div className="modes">
        <button className={`mode-btn${vue === "grille" ? " active" : ""}`} onClick={() => setVue("grille")}>
          ▦ Grille
        </button>
        <button
          className={`mode-btn${vue === "galerie" ? " active" : ""}`}
          onClick={() => {
            setGalerieIdx(0);
            setVue("galerie");
          }}
        >
          ◧ Galerie
        </button>
        <button className={`mode-btn${vue === "liste" ? " active" : ""}`} onClick={() => setVue("liste")}>
          ☰ Liste
        </button>
      </div>

      {contenu.bannerActif && contenu.bannerPosition === "bas" && bannerNode}

      {vue === "grille" && (
        <>
          <div className={`grid${contenu.degradeActif ? " degrade" : ""}`}>
            {produits.map((p, i) => (
              <div key={p.article.id} className={`tile ${p.grande ? "big" : "small"}`} onClick={() => ouvrir(i)}>
                <span className={`tile-stock${p.dispo !== null && p.dispo <= 0 ? " rupture" : ""}`} style={{ display: p.dispo === null ? "none" : undefined }} />
                <span className="tile-price">{formatFcfa(p.prixEffectif)}</span>
                {p.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photos[0]} alt={p.article.nom} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span className="glyph">{p.glyph}</span>
                )}
              </div>
            ))}
          </div>
          <div className="hint">Touchez une vignette pour l&apos;ouvrir en plein écran</div>
        </>
      )}

      {vue === "galerie" && produitGalerie && (
        <div className="galerie-page" onPointerDown={sortirPanorama}>
          <div className="rotate-hint">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="6" y="2" width="12" height="20" rx="2" />
            </svg>
            S&apos;adapte à la rotation
          </div>
          {panorama && (
            <div className="panorama-badge on">
              <span className="dot" /> Mode panorama
            </div>
          )}
          <div className="galerie-frame">
            <GlyphOuPhoto key={galerieIdx} sens={galerieSens} photo={produitGalerie.photos[0]} nom={produitGalerie.article.nom} glyph={produitGalerie.glyph} />
          </div>
          <div className="galerie-info">
            <div className="eyebrow">{produitGalerie.brancheNom}</div>
            <h3>{produitGalerie.article.nom}</h3>
            <div className="prix">{formatFcfa(produitGalerie.prixEffectif)}</div>
          </div>
          <div className="galerie-arrows">
            <button
              onClick={() => {
                sortirPanorama();
                setGalerieSens(-1);
                setGalerieIdx((i) => (i - 1 + produits.length) % produits.length);
              }}
            >
              ←
            </button>
            <span style={{ alignSelf: "center", fontSize: 11, color: "var(--ink-dim)" }}>
              {galerieIdx + 1} / {produits.length}
            </span>
            <button
              onClick={() => {
                sortirPanorama();
                setGalerieSens(1);
                setGalerieIdx((i) => (i + 1) % produits.length);
              }}
            >
              →
            </button>
          </div>
        </div>
      )}

      {vue === "liste" && (
        <div className="liste-page">
          {produits.map((p, i) => (
            <div key={p.article.id} className="liste-row" onClick={() => ouvrir(i)}>
              <div className="liste-thumb">
                {p.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photos[0]} alt={p.article.nom} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
                ) : (
                  p.glyph
                )}
              </div>
              <div>
                <div className="liste-branche">{p.brancheNom}</div>
                <div className="liste-nom">{p.article.nom}</div>
              </div>
              <div className="liste-prix">{formatFcfa(p.prixEffectif)}</div>
            </div>
          ))}
        </div>
      )}

      {produitOuvert && (
        <div className="viewer open">
          <div className="viewer-count">
            {ouvertIdx! + 1} / {produits.length}
          </div>
          <button className="viewer-close" onClick={() => setOuvertIdx(null)}>
            ×
          </button>
          <button className="viewer-nav prev" onClick={() => avancerViewer(-1)}>
            ←
          </button>
          <button className="viewer-nav next" onClick={() => avancerViewer(1)}>
            →
          </button>
          <div className="viewer-media">
            <GlyphOuPhoto key={`${ouvertIdx}-${imgIdx}`} sens={viewerSens} photo={produitOuvert.photos[imgIdx]} nom={produitOuvert.article.nom} glyph={produitOuvert.glyph} />
          </div>
          <div className="viewer-band">
            <div>
              <div className="eyebrow">{produitOuvert.brancheNom}</div>
              <h2>{produitOuvert.article.nom}</h2>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="viewer-price">{formatFcfa(produitOuvert.prixEffectif)}</div>
              <a className="viewer-cta" href={lienWhatsapp(produitOuvert.article.nom)} target="_blank" rel="noreferrer">
                Voir sur WhatsApp →
              </a>
            </div>
          </div>
          {produitOuvert.photos.length > 1 && (
            <div className="viewer-dots">
              {produitOuvert.photos.map((_, gi) => (
                <span
                  key={gi}
                  className={`viewer-dot${gi === imgIdx ? " active" : ""}`}
                  onClick={() => {
                    setViewerSens(gi > imgIdx ? 1 : -1);
                    setImgIdx(gi);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GlyphOuPhoto({ photo, nom, glyph }: { sens: 1 | -1; photo?: string; nom: string; glyph: string }) {
  const [entre, setEntre] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setEntre(true)));
    return () => cancelAnimationFrame(t);
  }, []);
  const style = { opacity: entre ? 1 : 0, transform: entre ? "translateX(0) scale(1)" : "translateX(16px) scale(0.95)", transition: "opacity .3s cubic-bezier(.2,.7,.3,1), transform .3s cubic-bezier(.2,.7,.3,1)" };
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={nom} style={{ width: "100%", height: "100%", objectFit: "cover", ...style }} />;
  }
  return (
    <span className="glyph" style={style}>
      {glyph}
    </span>
  );
}

const NOS_PRODUITS_CSS = `
.np-root {
  --canvas: #121212; --canvas-soft: #1a1a1a; --tile: #ffffff; --ink: #f4f3f0; --ink-dim: #9a988f;
  --accent: #c9974f; --line: #2c2b28;
  background: var(--canvas); color: var(--ink); min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
.np-root * { box-sizing: border-box; }

.np-root .topbar { display: flex; align-items: center; justify-content: center; padding: 16px 0 10px; }
.np-root .mark { font-size: 13px; font-weight: 800; letter-spacing: 0.28em; color: var(--ink-dim); }
.np-root .mark b { color: var(--accent); font-weight: 800; }

.np-root .banner { background: var(--canvas-soft); border-bottom: 1px solid var(--line); padding: 7px 14px; text-align: center; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; }
.np-root .banner.grand { padding: 15px 14px; font-size: 13px; }
.np-root .banner b { color: var(--accent); }

.np-root .modes { display: flex; justify-content: center; gap: 8px; padding: 4px 0 16px; }
.np-root .mode-btn { background: none; border: 1px solid var(--line); color: var(--ink-dim); padding: 6px 14px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer; }
.np-root .mode-btn.active { background: var(--ink); color: var(--canvas); border-color: var(--ink); }

.np-root .grid { display: grid; grid-template-columns: repeat(6, 1fr); grid-auto-rows: 92px; gap: 10px; padding: 6px 14px 40px; max-width: 900px; margin: 0 auto; }
.np-root .grid.degrade .tile { background: linear-gradient(155deg, var(--tile), #e8e2d8); }
.np-root .tile { position: relative; background: var(--tile); border-radius: 10px; overflow: hidden; cursor: pointer; grid-column: span 2; grid-row: span 2; display: flex; align-items: center; justify-content: center; transition: transform .18s ease; }
.np-root .tile:active { transform: scale(0.96); }
.np-root .tile.big { grid-column: span 3; grid-row: span 3; }
.np-root .tile .glyph { font-size: 30%; opacity: 0.55; }
.np-root .tile.big .glyph { font-size: 34%; }
.np-root .tile-price { position: absolute; bottom: 6px; left: 6px; z-index: 2; background: rgba(18,18,18,0.85); color: #fff; font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 5px; font-variant-numeric: tabular-nums; }
.np-root .tile-stock { position: absolute; top: 6px; left: 6px; z-index: 2; width: 8px; height: 8px; border-radius: 999px; background: #34d399; }
.np-root .tile-stock.rupture { background: #f87171; }
@media (max-width: 640px) { .np-root .grid { grid-template-columns: repeat(4, 1fr); grid-auto-rows: 78px; gap: 8px; padding: 4px 10px 32px; } }
@media (min-width: 900px) and (orientation: landscape) { .np-root .grid { grid-template-columns: repeat(8, 1fr); grid-auto-rows: 84px; max-width: 1180px; } }

.np-root .hint { text-align: center; font-size: 11px; color: var(--ink-dim); letter-spacing: 0.05em; padding-bottom: 24px; }

.np-root .galerie-page { max-width: 480px; margin: 0 auto; padding: 0 14px 40px; text-align: center; position: relative; }
.np-root .galerie-frame { position: relative; aspect-ratio: 3/4; background: var(--tile); border-radius: 12px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.np-root .galerie-frame .glyph { font-size: 34vw; opacity: 0.55; }
.np-root .galerie-info { margin-top: 14px; }
.np-root .galerie-info .eyebrow { font-size: 10.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); }
.np-root .galerie-info h3 { margin: 4px 0 0; font-size: 19px; }
.np-root .galerie-info .prix { margin-top: 6px; font-size: 20px; font-weight: 800; }
.np-root .galerie-arrows { display: flex; justify-content: space-between; margin-top: 14px; }
.np-root .galerie-arrows button { background: var(--canvas-soft); border: 1px solid var(--line); color: var(--ink); width: 42px; height: 42px; border-radius: 999px; font-size: 16px; cursor: pointer; }
.np-root .rotate-hint { position: absolute; top: -2px; right: 14px; display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--ink-dim); background: var(--canvas-soft); border: 1px solid var(--line); border-radius: 999px; padding: 5px 10px 5px 7px; }
.np-root .rotate-hint svg { animation: npRotateHint 3.4s ease-in-out infinite; transform-origin: center; }
@keyframes npRotateHint { 0%,15% { transform: rotate(0deg); } 42%,58% { transform: rotate(90deg); } 85%,100% { transform: rotate(0deg); } }
.np-root .panorama-badge { position: absolute; top: -2px; left: 14px; display: flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 700; color: var(--accent); letter-spacing: 0.04em; text-transform: uppercase; }
.np-root .panorama-badge .dot { width: 6px; height: 6px; border-radius: 999px; background: var(--accent); animation: npPulseDot 1.4s ease-in-out infinite; }
@keyframes npPulseDot { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

.np-root .liste-page { max-width: 640px; margin: 0 auto; padding: 0 14px 40px; }
.np-root .liste-row { display: flex; align-items: center; gap: 14px; padding: 12px 8px; border-bottom: 1px solid var(--line); cursor: pointer; }
.np-root .liste-thumb { width: 46px; height: 46px; border-radius: 8px; background: var(--tile); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; overflow: hidden; }
.np-root .liste-nom { font-size: 14px; font-weight: 700; }
.np-root .liste-branche { font-size: 10px; color: var(--accent); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.np-root .liste-prix { margin-left: auto; font-size: 13px; font-weight: 800; white-space: nowrap; }

.np-root .viewer { position: fixed; inset: 0; z-index: 100; background: #000; display: flex; align-items: center; justify-content: center; }
.np-root .viewer-media { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #fff; overflow: hidden; }
.np-root .viewer-media .glyph { font-size: min(40vw, 40vh); opacity: 0.55; }
.np-root .viewer-close { position: fixed; top: 18px; right: 18px; z-index: 110; width: 42px; height: 42px; border-radius: 999px; border: none; background: rgba(0,0,0,0.55); color: #fff; font-size: 20px; cursor: pointer; }
.np-root .viewer-nav { position: fixed; top: 50%; transform: translateY(-50%); z-index: 110; width: 46px; height: 46px; border-radius: 999px; border: none; background: rgba(0,0,0,0.4); color: #fff; font-size: 18px; cursor: pointer; }
.np-root .viewer-nav.prev { left: 14px; } .np-root .viewer-nav.next { right: 14px; }
.np-root .viewer-band { position: fixed; left: 0; right: 0; bottom: 0; z-index: 105; background: linear-gradient(to top, rgba(0,0,0,0.82), transparent); padding: 40px 22px 22px; display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; color: #fff; }
.np-root .viewer-band .eyebrow { font-size: 10.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent); }
.np-root .viewer-band h2 { margin: 4px 0 0; font-size: 22px; font-weight: 800; }
.np-root .viewer-price { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
.np-root .viewer-cta { margin-top: 8px; display: inline-flex; align-items: center; gap: 8px; background: #1f7a4d; color: #fff; border: none; padding: 12px 18px; border-radius: 999px; font-size: 12.5px; font-weight: 800; letter-spacing: 0.03em; cursor: pointer; white-space: nowrap; text-decoration: none; }
.np-root .viewer-count { position: fixed; top: 20px; left: 20px; z-index: 110; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.7); letter-spacing: 0.08em; }
.np-root .viewer-dots { position: fixed; bottom: 0; left: 0; right: 0; z-index: 106; display: flex; justify-content: center; gap: 7px; padding-bottom: 14px; }
.np-root .viewer-dot { width: 7px; height: 7px; border-radius: 999px; background: #fff; opacity: 0.4; cursor: pointer; }
.np-root .viewer-dot.active { opacity: 1; }
@media (orientation: landscape) {
  .np-root .viewer-band { left: auto; width: min(360px, 46vw); top: 0; bottom: 0; background: linear-gradient(to left, rgba(0,0,0,0.82), transparent 60%); align-items: flex-end; flex-direction: column; padding: 22px 22px 26px; }
  .np-root .viewer-cta { align-self: flex-start; }
  .np-root .viewer-dots { bottom: 14px; }
}

.np-root .nav-toggle { position: fixed; top: 16px; left: 16px; z-index: 200; width: 40px; height: 40px; border-radius: 999px; border: 1px solid var(--line); background: var(--canvas-soft); color: var(--ink); font-size: 17px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.np-root .admin-toggle { position: fixed; top: 16px; left: 64px; z-index: 200; width: 40px; height: 40px; border-radius: 999px; border: 1px solid var(--line); background: var(--canvas-soft); color: var(--ink); font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.np-root .admin-scrim { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 210; display: none; }
.np-root .admin-scrim.open { display: block; }
.np-root .admin-menu { position: fixed; top: 0; bottom: 0; left: 0; z-index: 211; width: min(280px, 82vw); background: var(--canvas-soft); border-right: 1px solid var(--line); transform: translateX(-100%); transition: transform .28s cubic-bezier(.2,.7,.3,1); padding: 20px 18px; overflow-y: auto; }
.np-root .admin-menu.open { transform: translateX(0); }
.np-root .admin-menu h4 { margin: 0 0 4px; font-size: 13px; font-weight: 800; }
.np-root .admin-menu .sous { font-size: 10.5px; color: var(--ink-dim); margin-bottom: 18px; }
.np-root .admin-group { margin-bottom: 20px; }
.np-root .admin-group .titre { font-size: 9.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-dim); margin-bottom: 8px; }
.np-root .admin-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 0; font-size: 12.5px; }
.np-root .admin-row .sw { width: 34px; height: 19px; border-radius: 999px; background: var(--line); position: relative; cursor: pointer; flex-shrink: 0; border: none; }
.np-root .admin-row .sw .knob { position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 999px; background: var(--ink-dim); transition: transform .2s ease, background .2s ease; }
.np-root .admin-row .sw.on { background: var(--accent); }
.np-root .admin-row .sw.on .knob { transform: translateX(15px); background: #1a1200; }
.np-root .admin-manage-btn { width: 100%; margin-top: 4px; background: var(--accent); color: #1a1200; border: none; padding: 12px; border-radius: 8px; font-size: 12.5px; font-weight: 800; cursor: pointer; letter-spacing: 0.02em; }
.np-root .admin-shortcut { display: block; padding: 9px 0; font-size: 12px; color: var(--ink); opacity: 0.85; cursor: pointer; text-decoration: none; }
.np-root .admin-shortcut .arrow { color: var(--ink-dim); }

.np-root .manage-panel { position: fixed; top: 0; bottom: 0; right: 0; z-index: 220; width: min(460px, 92vw); background: #1a1a1a; border-left: 1px solid var(--line); transform: translateX(100%); transition: transform .3s cubic-bezier(.2,.7,.3,1), width .28s ease; display: flex; flex-direction: column; }
.np-root .manage-panel.open { transform: translateX(0); }
.np-root .manage-panel.full { width: 100vw; }
.np-root .manage-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--line); flex-shrink: 0; }
.np-root .manage-head h3 { margin: 0; font-size: 14px; }
.np-root .manage-head-btns { display: flex; gap: 8px; }
.np-root .manage-head button { background: var(--canvas-soft); border: 1px solid var(--line); color: var(--ink); width: 32px; height: 32px; border-radius: 8px; font-size: 13px; cursor: pointer; }
.np-root .manage-body { padding: 18px; overflow-y: auto; flex: 1; }
.np-root .manage-card { background: var(--canvas-soft); border: 1px solid var(--line); border-radius: 10px; padding: 16px; margin-bottom: 14px; }
.np-root .manage-card .titre { font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-dim); }
.np-root .manage-card .valeur { margin-top: 6px; font-size: 24px; font-weight: 800; }
.np-root .manage-card .note { margin-top: 4px; font-size: 11px; color: var(--ink-dim); }
.np-root .manage-card .lien { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font-size: 11.5px; font-weight: 700; color: var(--accent); cursor: pointer; text-decoration: none; }
`;
