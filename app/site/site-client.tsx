"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { articles, branches } from "@/db/schema";
import type { SiteContenu } from "./actions";

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

const CONTACT_TELEPHONE = "22374744082";
const CONTACT_AFFICHAGE = "+223 74 74 40 82";
const FAMILLE_GLYPH: Record<string, string> = { A: "👕", B: "☕", C: "🎨", D: "💻", E: "🎁" };

function formatFcfa(v: string | number) {
  return `${Math.round(Number(v)).toLocaleString("fr-FR")} FCFA`;
}

function prixApresPromo(prixVente: number, promo: PromotionActive | undefined) {
  if (!promo) return prixVente;
  return promo.type === "POURCENTAGE" ? prixVente * (1 - promo.valeur / 100) : Math.max(0, prixVente - promo.valeur);
}

function lienWhatsapp(nom: string, detail?: string) {
  const texte = `Bonjour, je suis intéressé(e) par : ${nom}${detail ? ` (${detail})` : ""}. Est-ce disponible ?`;
  return `https://wa.me/${CONTACT_TELEPHONE}?text=${encodeURIComponent(texte)}`;
}

interface Produit {
  article: Article;
  brancheNom: string | null;
  variantesArticle: VarianteRow[];
  kitStock?: KitStock;
  promo?: PromotionActive;
  glyph: string;
  photo: string | null;
  dispo: number | null;
  prixEffectif: number;
}

function calculerDispo(article: Article, variantesArticle: VarianteRow[], kitStock?: KitStock): number | null {
  if (article.famille === "A") return variantesArticle.reduce((s, v) => s + (v.stockDetail ?? 0), 0);
  if (article.famille === "B") return variantesArticle[0]?.stockDetail ?? 0;
  if (article.famille === "E") return kitStock?.stockKitCalcule ?? 0;
  return null;
}

function StockBadge({ dispo, inline }: { dispo: number | null; inline?: boolean }) {
  if (dispo === null) return null;
  const cls = inline ? "stock-pill" : "card-stock";
  if (dispo <= 0) return <span className={`${cls} rupture`}>Rupture</span>;
  return <span className={cls}>En stock</span>;
}

export function SiteClient({
  articles: articleRows,
  variantes: varianteRows,
  branches: brancheRows,
  kitStocks,
  promotions,
  banniere,
  contenu,
}: {
  articles: Article[];
  variantes: VarianteRow[];
  branches: Branche[];
  kitStocks: KitStock[];
  promotions: PromotionActive[];
  banniere: Banniere;
  contenu: SiteContenu;
}) {
  const produits: Produit[] = useMemo(() => {
    return articleRows.map((article) => {
      const variantesArticle = varianteRows.filter((v) => v.articleId === article.id);
      const branche = brancheRows.find((b) => b.id === article.brancheId);
      const kitStock = kitStocks.find((k) => k.articleId === article.id);
      const promo = promotions.find((p) => p.articleId === article.id);
      const dispo = calculerDispo(article, variantesArticle, kitStock);
      const photo = variantesArticle.find((v) => v.photoUrl)?.photoUrl || article.photoUrl;
      return {
        article,
        brancheNom: branche?.nom ?? null,
        variantesArticle,
        kitStock,
        promo,
        glyph: FAMILLE_GLYPH[article.famille] ?? "🛍️",
        photo,
        dispo,
        prixEffectif: prixApresPromo(Number(article.prixVente), promo),
      };
    });
  }, [articleRows, varianteRows, brancheRows, kitStocks, promotions]);

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  const [filtre, setFiltre] = useState("TOUS");
  function appliquerFiltre(valeur: string) {
    setFiltre(valeur);
    setGalerieIdx(0);
    scrollTo("catalogue");
  }
  const produitsFiltres = useMemo(
    () => (filtre === "TOUS" ? produits : produits.filter((p) => p.brancheNom === filtre)),
    [produits, filtre]
  );

  const [vue, setVue] = useState<"grande" | "petite" | "liste" | "galerie">("grande");
  const [galerieIdx, setGalerieIdx] = useState(0);
  const [produitOuvert, setProduitOuvert] = useState<Produit | null>(null);

  // Un panneau ouvert (fiche produit) ajoute une entrée d'historique — sur mobile, le bouton
  // "retour" du téléphone doit d'abord refermer le panneau, jamais quitter le site directement
  // (bug remonté le 2026-08-09).
  const overlayOuvert = produitOuvert !== null;
  useEffect(() => {
    if (!overlayOuvert) return;
    window.history.pushState({ evolutis223Overlay: true }, "");
  }, [overlayOuvert]);

  useEffect(() => {
    function onPopState() {
      setProduitOuvert(null);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function fermerOverlay() {
    if (overlayOuvert) window.history.back();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      fermerOverlay();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [overlayOuvert]);

  // ---------------- HERO DIAPORAMA ----------------
  // Sur mobile, le défilement automatique est desactivé (demande explicite du 2026-08-09) : on
  // garde uniquement le premier visuel, fixe, plus lisible et plus sobre sur petit écran.
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroFading, setHeroFading] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches) return;
    const t = setInterval(() => {
      setHeroFading(true);
      setTimeout(() => {
        setHeroIdx((i) => (i + 1) % contenu.heroSlides.length);
        setHeroFading(false);
      }, 400);
    }, 4200);
    return () => clearInterval(t);
  }, [contenu.heroSlides.length]);
  const heroSlide = contenu.heroSlides[heroIdx] ?? contenu.heroSlides[0];

  // ---------------- BANNER CAROUSEL ----------------
  const bannerSlides = useMemo(() => {
    if (banniere.active && banniere.message) {
      return [{ tag: "Annonce", texte: banniere.message, bg: "#0b0b0b" }, ...contenu.bannerSlides];
    }
    return contenu.bannerSlides;
  }, [banniere, contenu.bannerSlides]);
  const [bannerIdx, setBannerIdx] = useState(0);
  useEffect(() => {
    if (bannerSlides.length <= 1) return;
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches) return;
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % bannerSlides.length), 4500);
    return () => clearInterval(t);
  }, [bannerSlides.length]);

  function ouvrirFiche(p: Produit) {
    setProduitOuvert(p);
  }

  return (
    <div className="site-root" style={{ background: "#ffffff", color: "#0b0b0b" }}>
      <style dangerouslySetInnerHTML={{ __html: SITE_CSS }} />

      <nav className={`nav${scrolled ? " scrolled" : ""}`}>
        <div className="nav-mark-group">
          <div className="nav-mark">
            EVOLUTIS<span>223</span>
          </div>
          <span className="nav-divider"></span>
          <div className="nav-subbrands">
            {contenu.universCards.map((u) => (
              <a key={u.marque} onClick={() => appliquerFiltre(u.marque)}>
                {u.marque}
              </a>
            ))}
          </div>
        </div>
        <div className="nav-links">
          <a onClick={() => scrollTo("catalogue")}>Catalogue</a>
        </div>
        <div className="nav-right">
          <div className="nav-cart icon-zoom" onClick={() => scrollTo("catalogue")}>
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.2" y2="16.2" />
            </svg>
            <span>Rechercher</span>
          </div>
        </div>
      </nav>

      <section className="hero" id="hero-top">
        <div className="hero-grid">
          <div>
            <div className="hero-eyebrow">
              <span className="dot"></span>
              <span className="eyebrow">{contenu.eyebrow}</span>
            </div>
            <h1>
              Style qui
              <br />
              se <em>porte.</em>
            </h1>
            <p className="lead">{contenu.leadText}</p>
            <div className="hero-badge">
              <b>{contenu.badgeAnnees}</b> {contenu.badgeLabel}
            </div>
            <div className="hero-cta">
              <button className="btn-primary" onClick={() => scrollTo("catalogue")}>
                Découvrir la collection →
              </button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-frame">
              <span className={`glyph${heroFading ? " fading" : ""}`}>{heroSlide.glyph}</span>
              <div className="hero-dots">
                {contenu.heroSlides.map((_, i) => (
                  <span
                    key={i}
                    className={`hero-dot${i === heroIdx ? " active" : ""}`}
                    onClick={() => {
                      setHeroFading(true);
                      setTimeout(() => {
                        setHeroIdx(i);
                        setHeroFading(false);
                      }, 400);
                    }}
                  />
                ))}
              </div>
            </div>
            <div className={`hero-tag${heroFading ? " fading" : ""}`}>
              {heroSlide.tag}
              <b>{heroSlide.bold}</b>
            </div>
          </div>
        </div>
        <div className="scroll-cue">
          <span>Défiler</span>
          <span className="line"></span>
        </div>
      </section>

      <div className="banner-carousel">
        <div className="banner-track" style={{ transform: `translateX(-${bannerIdx * 100}%)` }}>
          {bannerSlides.map((s, i) => (
            <div key={i} className="banner-slide" style={{ background: s.bg, color: "#fff" }}>
              <span className="tag" style={{ background: "rgba(255,255,255,0.18)" }}>
                {s.tag}
              </span>
              <span>{s.texte}</span>
            </div>
          ))}
        </div>
        {bannerSlides.length > 1 && (
          <div className="banner-dots">
            {bannerSlides.map((_, i) => (
              <span key={i} className={`banner-dot${i === bannerIdx ? " active" : ""}`} style={{ color: "#fff" }} onClick={() => setBannerIdx(i)} />
            ))}
          </div>
        )}
      </div>

      <section className="section reveal-in catalogue-section" id="catalogue" style={{ background: "var(--catalogue-bg)" }}>
        <div>
          <div className="section-head">
            <div>
              <div className="eyebrow">Catalogue</div>
              <h2>Nos produits</h2>
            </div>
          </div>

          <div className="controls-row">
            <div className="filters">
              <button className={`filter-pill${filtre === "TOUS" ? " active" : ""}`} onClick={() => appliquerFiltre("TOUS")}>
                Tous
              </button>
              {contenu.universCards.map((u) => (
                <button key={u.marque} className={`filter-pill${filtre === u.marque ? " active" : ""}`} onClick={() => appliquerFiltre(u.marque)}>
                  <span className="filter-pill-glyph">{u.glyph}</span> {u.marque}
                </button>
              ))}
            </div>
            <div className="view-switch">
              <button className={`view-btn${vue === "grande" ? " active" : ""}`} onClick={() => setVue("grande")} title="Grandes vignettes">
                <span className="view-btn-icon">▦</span>
                <span className="view-btn-label-full">Grandes vignettes</span>
                <span className="view-btn-label-short">Grandes</span>
              </button>
              <button className={`view-btn${vue === "petite" ? " active" : ""}`} onClick={() => setVue("petite")} title="Petites vignettes">
                <span className="view-btn-icon">▪▪</span>
                <span className="view-btn-label-full">Petites vignettes</span>
                <span className="view-btn-label-short">Petites</span>
              </button>
              <button className={`view-btn${vue === "liste" ? " active" : ""}`} onClick={() => setVue("liste")} title="Liste">
                <span className="view-btn-icon">☰</span>
                <span className="view-btn-label">Liste</span>
              </button>
              <button
                className={`view-btn${vue === "galerie" ? " active" : ""}`}
                onClick={() => {
                  setGalerieIdx(0);
                  setVue("galerie");
                }}
                title="Galerie"
              >
                <span className="view-btn-icon">◧</span>
                <span className="view-btn-label">Galerie</span>
              </button>
            </div>
          </div>

          {(vue === "grande" || vue === "petite") && (
            <div className={`grid${vue === "petite" ? " petite" : ""}`}>
              {produitsFiltres.map((p, i) => (
                <Fragment key={p.article.id}>
                  <div className="card" onClick={() => ouvrirFiche(p)}>
                    <div className="card-media">
                      <StockBadge dispo={p.dispo} />
                      {p.brancheNom && <span className="card-branche">{p.brancheNom}</span>}
                      <span className="card-prix">{formatFcfa(p.prixEffectif)}</span>
                      {p.promo && <span className="card-promo">Promo</span>}
                      {p.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo} alt={p.article.nom} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span className="glyph">{p.glyph}</span>
                      )}
                    </div>
                    <div className="card-body">
                      <div className="card-nom">{p.article.nom}</div>
                    </div>
                  </div>
                  {i === 3 && (
                    <div className="ad-slot">
                      <div className="eyebrow">Espace partenaire</div>
                      <strong>Votre bannière ici</strong>
                    </div>
                  )}
                  {i === 9 && (
                    <div className="ad-slot">
                      <div className="brand-cube-wrap">
                        <div className="brand-cube">
                          {contenu.universCards.map((u) => (
                            <div key={u.marque} className="cube-face">
                              {u.marque}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          )}

          {vue === "liste" && (
            <div className="list-view">
              {produitsFiltres.map((p) => (
                <div key={p.article.id} className="list-row" onClick={() => ouvrirFiche(p)}>
                  <div className="list-thumb">
                    {p.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photo} alt={p.article.nom} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      p.glyph
                    )}
                  </div>
                  <div className="list-info">
                    <div className="list-nom">{p.article.nom}</div>
                    <div className="list-branche">{p.brancheNom}</div>
                  </div>
                  <div className="list-prix">{formatFcfa(p.prixEffectif)}</div>
                  <button
                    className="list-buy"
                    onClick={(e) => {
                      e.stopPropagation();
                      ouvrirFiche(p);
                    }}
                  >
                    Voir
                  </button>
                </div>
              ))}
            </div>
          )}

          {vue === "galerie" && (
            <GalerieView produits={produitsFiltres} idx={galerieIdx} setIdx={setGalerieIdx} onAcheter={ouvrirFiche} />
          )}
        </div>
      </section>

      <section className="section reveal-in vision-section" id="vision">
        <div className="vision-grid">
          <div className="vision-image">
            <span className="glyph">🧵</span>
            <span className="vision-image-label">Photo à venir</span>
          </div>
          <div>
            <div className="vision-inner">
              <div className="eyebrow">Notre vision</div>
              <h2 style={{ color: "var(--bg)" }}>
                {contenu.visionTitreLigne1}
                <br />
                {contenu.visionTitreLigne2}
              </h2>
              <p className="vision-text">{contenu.visionText}</p>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-grid">
          <div className="footer-identity">
            <div className="footer-mark">
              EVOLUTIS<span>223</span>
            </div>
            <p>
              {contenu.footerTagline}
              <br />
              Bamako, Mali
            </p>
          </div>
          <div className="footer-col">
            <h4>Univers</h4>
            {contenu.universCards.map((u) => (
              <a key={u.marque} onClick={() => appliquerFiltre(u.marque)}>
                {u.marque}
              </a>
            ))}
          </div>
          <div className="footer-col">
            <h4>Boutique</h4>
            <a onClick={() => scrollTo("catalogue")}>Catalogue</a>
            <a href={lienWhatsapp("votre commande")} target="_blank" rel="noreferrer">
              Suivre ma commande
            </a>
            <a href={lienWhatsapp("un renseignement")} target="_blank" rel="noreferrer">
              Nous contacter
            </a>
          </div>
          <div className="footer-col">
            <h4>Contact</h4>
            <a href={`tel:+${CONTACT_TELEPHONE}`}>{CONTACT_AFFICHAGE}</a>
            <a href="mailto:evolutis223@gmail.com">evolutis223@gmail.com</a>
            <a href={lienWhatsapp("un renseignement")} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} EVOLUTIS223. Tous droits réservés.</span>
          <span>Bamako, Mali</span>
        </div>
      </footer>

      {produitOuvert && <DetailPanel produit={produitOuvert} onClose={() => setProduitOuvert(null)} />}
    </div>
  );
}

function GalerieView({
  produits,
  idx,
  setIdx,
  onAcheter,
}: {
  produits: Produit[];
  idx: number;
  setIdx: (i: number) => void;
  onAcheter: (p: Produit) => void;
}) {
  const i = idx >= produits.length ? 0 : idx;
  const p = produits[i];
  const [startX, setStartX] = useState<number | null>(null);

  function avancer(d: number) {
    setIdx((i + d + produits.length) % produits.length);
  }

  if (!p) {
    return <p style={{ textAlign: "center", color: "var(--muted)" }}>Aucun produit.</p>;
  }

  const media = (
    <div className="galerie-media">
      {p.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.photo} alt={p.article.nom} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span className="glyph">{p.glyph}</span>
      )}
      <div className="galerie-overlay">
        <div className="gv-left">
          <span className="eyebrow">{p.brancheNom}</span>
          <h3>{p.article.nom}</h3>
        </div>
        <div className="gv-right">
          <div className="price">{formatFcfa(p.prixEffectif)}</div>
          <button className="btn-primary galerie-buy" onClick={() => onAcheter(p)}>
            Voir & acheter
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="galerie-view">
      <div className="galerie-stage">
        <button className="galerie-nav prev" onClick={() => avancer(-1)}>
          ←
        </button>
        <button className="galerie-nav next" onClick={() => avancer(1)}>
          →
        </button>
        <div
          onMouseDown={(e) => setStartX(e.clientX)}
          onMouseUp={(e) => {
            if (startX === null) return;
            const dx = e.clientX - startX;
            if (Math.abs(dx) > 40) avancer(dx < 0 ? 1 : -1);
            setStartX(null);
          }}
          onTouchStart={(e) => setStartX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (startX === null) return;
            const dx = e.changedTouches[0].clientX - startX;
            if (Math.abs(dx) > 40) avancer(dx < 0 ? 1 : -1);
            setStartX(null);
          }}
        >
          {media}
        </div>
      </div>
      <div className="filmstrip">
        {produits.map((f, fi) => (
          <div key={f.article.id} className={`film-thumb${fi === i ? " active" : ""}`} onClick={() => setIdx(fi)}>
            {f.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.photo} alt={f.article.nom} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              f.glyph
            )}
          </div>
        ))}
      </div>
      <div className="swipe-hint">👆 Glissez ou utilisez les flèches pour naviguer</div>
    </div>
  );
}

function DetailPanel({ produit, onClose }: { produit: Produit; onClose: () => void }) {
  const [selectedId, setSelectedId] = useState<number | null>(produit.variantesArticle[0]?.id ?? null);
  const selected = produit.variantesArticle.find((v) => v.id === selectedId);
  const tailles = Array.from(new Set(produit.variantesArticle.map((v) => v.taille).filter(Boolean))) as string[];

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const photo = selected?.photoUrl || produit.photo;
  const detailTexte = tailles.find((t) => t === selected?.taille);

  return (
    <div className="detail-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="detail-panel">
        <div className="detail-media">
          <button className="detail-close" onClick={onClose}>
            ×
          </button>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={produit.article.nom} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span className="glyph">{produit.glyph}</span>
          )}
        </div>
        <div className="detail-body">
          <div className="eyebrow">{produit.brancheNom}</div>
          <h2 style={{ marginTop: 8, fontSize: 28 }}>{produit.article.nom}</h2>
          <div className="detail-price">{formatFcfa(produit.prixEffectif)}</div>
          <StockBadge dispo={produit.dispo} inline />
          {tailles.length > 0 && (
            <div className="swatches">
              {tailles.map((t) => {
                const v = produit.variantesArticle.find((vv) => vv.taille === t);
                return (
                  <div key={t} className={`swatch${selected?.taille === t ? " active" : ""}`} onClick={() => v && setSelectedId(v.id)}>
                    {t}
                  </div>
                );
              })}
            </div>
          )}
          <div className="detail-ctas">
            <a className="cta-whatsapp" href={lienWhatsapp(produit.article.nom, detailTexte ?? undefined)} target="_blank" rel="noreferrer">
              <svg className="icon-zoom" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.35 5.07L2 22l5.1-1.33A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2Zm0 18c-1.62 0-3.13-.44-4.43-1.22l-.32-.19-3.03.79.8-2.95-.2-.32A7.9 7.9 0 0 1 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8Zm4.36-5.96c-.24-.12-1.41-.7-1.63-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1-.37-1.9-1.17-.7-.63-1.18-1.4-1.32-1.64-.14-.24-.01-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.41-.58 1.61-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
              </svg>
              Nous contacter sur WhatsApp
            </a>
            <a className="cta-call" href={`tel:+${CONTACT_TELEPHONE}`}>
              <svg className="icon-zoom" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
              </svg>
              Appeler la boutique
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

const SITE_CSS = `
:root {
  --bg: #ffffff; --bg-soft: #f7f6f3; --catalogue-bg: #ececea; --ink: #0b0b0b; --ink-soft: #3a3a3a;
  --muted: #7a7873; --line: #e7e4dd; --accent: #a8763e; --accent-soft: #f1e6d8;
  --footer-bg: #0b0b0b; --footer-ink: #ffffff; --footer-muted: #9c9a95;
  --media-bg: #ffffff; --media-shadow: 0 22px 40px -16px rgba(11,11,11,0.28);
}
.site-root * { box-sizing: border-box; }
html, body { overflow-x: hidden; max-width: 100%; }
/* Sur mobile, un appui un peu long sur du texte le sélectionnait (surlignage bleu) au lieu de
   simplement naviguer — gênant, ça casse la sensation d'appli. Désactivé partout sur la page. */
.site-root { -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
html { scroll-behavior: smooth; }
.vision-text, footer p { text-align: left; hyphens: none; }
.eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--accent); }
h1, h2, h3 { margin: 0; font-weight: 800; letter-spacing: -0.02em; }
a { cursor: pointer; }

.nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; gap: 22px; padding: 22px 5vw; background: rgba(255,255,255,0); transition: background .35s ease, padding .35s ease, border-color .35s ease; border-bottom: 1px solid transparent; }
.nav-mark-group { display: flex; align-items: center; gap: 16px; flex-shrink: 0; min-width: 0; }
.nav-divider { width: 1px; height: 18px; background: var(--line); flex-shrink: 0; }
.nav-subbrands { display: flex; align-items: center; gap: 13px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.nav-subbrands a { color: var(--muted); text-decoration: none; transition: color .2s ease; }
.nav-subbrands a:hover { color: var(--accent); }
@media (max-width: 900px) { .nav-subbrands { display: none; } }
.nav.scrolled { background: rgba(255,255,255,0.92); backdrop-filter: blur(10px); padding: 14px 5vw; border-color: var(--line); }
.nav-mark { font-size: 19px; font-weight: 800; letter-spacing: 0.02em; }
.nav-mark span { color: var(--accent); }
.nav-links { display: flex; align-items: center; gap: 34px; font-size: 12.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.nav-links a { color: var(--ink); text-decoration: none; position: relative; }
.nav-right { display: flex; align-items: center; gap: 18px; }
.nav-cart { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.icon-zoom { transition: transform .25s cubic-bezier(.4,0,.2,1); }
.icon-zoom:hover { transform: scale(1.14); color: var(--accent); }
@media (max-width: 1150px) { .nav-cart span { display: none; } .nav-cart svg { width: 23px; height: 23px; } }
@media (max-width: 900px) { .nav-links { display: none; } }

.hero { position: relative; min-height: 100vh; display: flex; align-items: center; padding: 0 5vw; overflow: hidden; }
.hero-grid { display: grid; grid-template-columns: 1.15fr 0.85fr; align-items: center; gap: 40px; width: 100%; padding-top: 60px; }
.hero-eyebrow { display: flex; align-items: center; gap: 10px; }
.hero-eyebrow .dot { width: 6px; height: 6px; border-radius: 999px; background: var(--accent); }
.hero h1 { margin-top: 18px; font-size: clamp(52px, 8.4vw, 118px); line-height: 0.92; letter-spacing: -0.03em; }
.hero h1 em { font-style: normal; color: transparent; -webkit-text-stroke: 1.5px var(--ink); }
.hero p.lead { margin-top: 26px; max-width: 420px; font-size: 17px; line-height: 1.7; color: var(--ink-soft); font-weight: 400; text-align: left; }
.hero-cta { margin-top: 38px; display: flex; align-items: center; gap: 22px; }
.btn-primary { display: inline-flex; align-items: center; gap: 10px; background: var(--ink); color: var(--bg); border: none; padding: 17px 30px; font-size: 12.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: transform .25s ease, background .25s ease; }
.btn-primary:hover { background: var(--accent); color: #fff; transform: translateY(-2px); }
.btn-ghost { font-size: 12.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink); text-decoration: none; border-bottom: 1.5px solid var(--ink); padding-bottom: 3px; }
.hero-badge { display: inline-flex; align-items: baseline; gap: 7px; margin-top: 20px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.hero-badge b { font-size: 17px; color: var(--accent); letter-spacing: 0; }
.hero-visual { position: relative; aspect-ratio: 3/4; }
.hero-frame { position: absolute; inset: 0; background: linear-gradient(155deg, var(--bg-soft), var(--accent-soft)); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.hero-frame .glyph { font-size: 140px; opacity: 0.22; transition: opacity .5s ease; }
.hero-frame .glyph.fading, .hero-tag.fading { opacity: 0; }
.hero-tag { position: absolute; bottom: -18px; left: -18px; background: var(--ink); color: var(--bg); padding: 16px 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; box-shadow: 0 20px 40px rgba(0,0,0,0.18); transition: opacity .4s ease; }
.hero-tag b { display: block; font-size: 20px; color: var(--accent); margin-top: 2px; letter-spacing: 0; }
.hero-dots { position: absolute; bottom: 14px; right: 14px; display: flex; gap: 6px; z-index: 2; }
.hero-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--ink); opacity: 0.25; cursor: pointer; transition: all .3s ease; }
.hero-dot.active { opacity: 1; width: 16px; border-radius: 3px; }
.scroll-cue { position: absolute; bottom: 34px; left: 5vw; display: flex; align-items: center; gap: 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); }
.scroll-cue .line { width: 34px; height: 1px; background: var(--muted); }

.banner-carousel { position: relative; overflow: hidden; }
.banner-track { display: flex; transition: transform .6s cubic-bezier(.4,0,.2,1); }
.banner-slide { min-width: 100%; display: flex; align-items: center; justify-content: center; gap: 16px; padding: 16px 20px; font-size: 13px; font-weight: 600; letter-spacing: 0.02em; text-align: center; }
.banner-slide .tag { font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 10px; border-radius: 999px; }
.banner-dots { position: absolute; right: 18px; top: 50%; transform: translateY(-50%); display: flex; gap: 6px; }
.banner-dot { width: 5px; height: 5px; border-radius: 999px; background: currentColor; opacity: 0.35; cursor: pointer; }
.banner-dot.active { opacity: 1; width: 14px; border-radius: 3px; transition: width .3s ease; }

.section { padding: 100px 5vw; }
.section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; flex-wrap: wrap; margin-bottom: 44px; }
.section-head h2 { font-size: clamp(34px, 4vw, 52px); }

.catalogue-section { padding-top: 90px; }
.controls-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 30px; }
.filters { display: flex; flex-wrap: wrap; gap: 10px; }
.filter-pill { display: flex; align-items: center; gap: 9px; border: 1.5px solid var(--line); background: var(--bg); color: var(--ink); padding: 11px 20px; border-radius: 999px; font-size: 12.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer; transition: all .25s ease; }
.filter-pill:hover { border-color: var(--ink); }
.filter-pill.active { background: var(--ink); border-color: var(--ink); color: var(--bg); }
.view-switch { display: flex; border: 1.5px solid var(--line); border-radius: 10px; overflow: hidden; flex-shrink: 0; }
.view-btn { display: flex; align-items: center; gap: 6px; background: var(--bg); color: var(--muted); border: none; padding: 10px 14px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer; border-right: 1.5px solid var(--line); white-space: nowrap; }
.view-btn:last-child { border-right: none; }
.view-btn.active { background: var(--ink); color: var(--bg); }
.view-btn-label-short { display: none; }
@media (max-width: 640px) {
  .catalogue-section { padding-top: 22px; }
  .controls-row { gap: 10px; margin-bottom: 20px; }
  .filters { gap: 6px; }
  .filter-pill { padding: 6px 10px; font-size: 9.5px; gap: 0; }
  .filter-pill-glyph { display: none; }
  .view-btn { padding: 8px 9px; font-size: 9.5px; gap: 4px; }
  .view-btn-icon { font-size: 12px; }
  .view-btn-label-full { display: none; }
  .view-btn-label-short { display: inline; }
}

.grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 26px; }
.grid.petite { grid-template-columns: repeat(9, 1fr); gap: 16px; }
.card { grid-column: span 2; cursor: pointer; min-width: 0; }
.grid.petite .card { grid-column: span 3; }
.card.wide { grid-column: span 3; }
.card-media { position: relative; aspect-ratio: 4/5; background: var(--media-bg); overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: var(--media-shadow); border: 1.5px solid transparent; transition: border-color .25s ease; }
.card:hover .card-media { border-color: var(--accent); }
.card.wide .card-media { aspect-ratio: 16/10; }
.grid.petite .card-media { aspect-ratio: 1/1; }
.card-media .glyph { font-size: 64px; opacity: 0.5; transition: transform .6s cubic-bezier(.16,1,.3,1); }
.grid.petite .card-media .glyph { font-size: 38px; }
.card:hover .card-media .glyph { transform: scale(1.12) rotate(-3deg); }
/* Badges directement sur la vignette (photo ou fond uni) : fond sombre uniforme partout, pour
   rester lisibles quel que soit le contenu derrière (le badge "En stock" blanc sur fond blanc
   était invisible — signalé le 2026-08-09). Un coin chacun : stock en haut à gauche, marque en
   haut à droite, prix en bas à gauche dans un cadre, promo en bas à droite si présente. */
.card-stock { position: absolute; top: 10px; left: 10px; z-index: 3; font-size: 9.5px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; padding: 5px 10px; background: rgba(11,11,11,0.85); color: #fff; }
.card-stock.rupture { background: rgba(122,31,31,0.9); }
.card-branche { position: absolute; top: 10px; right: 10px; z-index: 3; font-size: 9px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; padding: 5px 10px; background: rgba(11,11,11,0.85); color: var(--accent); }
.card-prix { position: absolute; bottom: 10px; left: 10px; z-index: 3; font-size: 16px; font-weight: 800; padding: 7px 12px; background: rgba(11,11,11,0.85); color: #fff; font-variant-numeric: tabular-nums; white-space: nowrap; }
.card-promo { position: absolute; bottom: 10px; right: 10px; z-index: 3; font-size: 9.5px; font-weight: 800; letter-spacing: 0.05em; padding: 5px 10px; background: var(--accent); color: #fff; }
.card-body { padding-top: 12px; }
.card-nom { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; overflow-wrap: break-word; }
.grid.petite .card-nom { font-size: 14px; }
.grid.petite .card-prix { font-size: 13px; padding: 5px 9px; }
.grid.petite .card-branche { font-size: 8px; padding: 4px 8px; }
.grid.petite .card-stock { font-size: 8.5px; padding: 4px 8px; }

.univers-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.univers-grid .card-media { aspect-ratio: 3/2; }
.univers-grid .card-media .glyph { font-size: 40px; }
.univers-grid .card-nom { font-size: 15px; }
@media (max-width: 900px) { .univers-grid { grid-template-columns: 1fr; } }

.ad-slot { grid-column: span 2; border: 1.5px dashed var(--line); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 22px; aspect-ratio: 4/5; gap: 8px; position: relative; overflow: hidden; background: linear-gradient(120deg, var(--bg-soft) 0%, var(--accent-soft) 50%, var(--bg-soft) 100%); }
.grid.petite .ad-slot { grid-column: span 3; aspect-ratio: 1/1; }
.ad-slot .eyebrow { color: var(--muted); }
.ad-slot strong { font-size: 17px; font-weight: 800; max-width: 200px; }
.brand-cube-wrap { perspective: 900px; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.brand-cube { position: relative; width: 46%; aspect-ratio: 1/1; transform-style: preserve-3d; animation: cubeSpin 10s linear infinite; }
.cube-face { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 10px; font-size: 13px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: #fff; backface-visibility: hidden; }
.cube-face:nth-child(1) { background: var(--ink); transform: rotateY(0deg) translateZ(min(20vw,90px)); }
.cube-face:nth-child(2) { background: var(--accent); transform: rotateY(120deg) translateZ(min(20vw,90px)); }
.cube-face:nth-child(3) { background: #2a2a28; transform: rotateY(240deg) translateZ(min(20vw,90px)); }
@keyframes cubeSpin { from { transform: rotateY(0deg); } to { transform: rotateY(-360deg); } }

.list-view { display: flex; flex-direction: column; }
.list-row { display: flex; align-items: center; gap: 20px; padding: 18px 6px; border-bottom: 1px solid var(--line); cursor: pointer; transition: background .2s ease; }
.list-row:hover { background: var(--bg-soft); }
.list-thumb { width: 64px; height: 64px; flex-shrink: 0; background: var(--media-bg); box-shadow: var(--media-shadow); display: flex; align-items: center; justify-content: center; font-size: 28px; overflow: hidden; }
.list-info { flex: 1; min-width: 0; }
.list-nom { font-size: 18px; font-weight: 700; }
.list-branche { font-size: 11px; color: var(--accent); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 2px; }
.list-prix { font-size: 18px; font-weight: 800; white-space: nowrap; }
.list-buy { background: var(--ink); color: var(--bg); border: none; padding: 9px 16px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
@media (max-width: 640px) {
  /* La ligne entière est déjà cliquable — le bouton "Voir" ne fait que voler de la place au nom
     du produit, qui se retrouvait compressé sur quelques caractères de large. */
  .list-row { gap: 10px; padding: 8px 4px; }
  .list-thumb { width: 44px; height: 44px; font-size: 20px; }
  .list-nom { font-size: 14px; }
  .list-branche { margin-top: 0; }
  .list-prix { font-size: 13px; }
  .list-buy { display: none; }
}

.galerie-view { display: flex; flex-direction: column; align-items: center; gap: 30px; }
.galerie-stage { position: relative; width: 100%; max-width: 620px; }
.galerie-media { position: relative; aspect-ratio: 4/5; background: var(--media-bg); box-shadow: var(--media-shadow); display: flex; align-items: center; justify-content: center; overflow: hidden; user-select: none; touch-action: pan-y; }
.galerie-media .glyph { font-size: 150px; opacity: 0.45; }
.galerie-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 48px; height: 48px; border-radius: 999px; background: var(--bg); border: 1.5px solid var(--line); font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.galerie-nav.prev { left: -22px; } .galerie-nav.next { right: -22px; }
@media (max-width: 900px) { .galerie-nav.prev { left: 4px; } .galerie-nav.next { right: 4px; } }
.galerie-overlay { position: absolute; left: 0; right: 0; bottom: 0; padding: 20px 24px; background: #0b0b0b; color: #fff; display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
.galerie-overlay .gv-left { text-align: left; min-width: 0; }
.galerie-overlay .gv-right { text-align: right; flex-shrink: 0; }
.galerie-overlay .eyebrow { color: #d9b98a; }
.galerie-overlay h3 { margin-top: 6px; font-size: 21px; color: #fff; }
.galerie-overlay .price { font-size: 26px; font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; }
.galerie-overlay .galerie-buy { margin-top: 10px; padding: 12px 22px; }
.filmstrip { display: flex; gap: 12px; overflow-x: auto; max-width: 100%; padding: 14px 2px 4px; }
.film-thumb { width: 68px; height: 68px; flex-shrink: 0; background: var(--media-bg); box-shadow: var(--media-shadow); border: 2px solid transparent; display: flex; align-items: center; justify-content: center; font-size: 28px; cursor: pointer; opacity: 0.5; transition: all .25s ease; overflow: hidden; }
.film-thumb.active { border-color: var(--accent); opacity: 1; }
.swipe-hint { margin-top: 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }

.detail-overlay { position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,0.4); display: flex; align-items: stretch; justify-content: flex-end; }
.detail-panel { width: min(560px, 92vw); background: var(--bg); height: 100%; overflow-y: auto; box-shadow: -30px 0 60px rgba(0,0,0,0.15); }
.detail-media { position: relative; aspect-ratio: 4/3.4; background: var(--media-bg); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.detail-media .glyph { font-size: 150px; opacity: 0.45; }
.detail-close { position: absolute; top: 20px; right: 20px; width: 40px; height: 40px; border-radius: 999px; background: var(--bg); color: var(--ink); border: none; font-size: 18px; cursor: pointer; }
.detail-body { padding: 34px 36px 44px; }
.detail-price { margin-top: 14px; font-size: 30px; font-weight: 800; }
.stock-pill { display: inline-block; margin-top: 10px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; padding: 5px 11px; background: rgba(11,11,11,0.85); color: #fff; }
.stock-pill.rupture { background: rgba(122,31,31,0.9); }
.swatches { margin-top: 26px; display: flex; flex-wrap: wrap; gap: 8px; }
.swatch { padding: 9px 16px; border: 1.5px solid var(--line); font-size: 12.5px; font-weight: 700; cursor: pointer; color: var(--ink); background: var(--bg); }
.swatch.active { background: var(--ink); color: var(--bg); border-color: var(--ink); }
.detail-ctas { margin-top: 32px; display: flex; flex-direction: column; gap: 10px; }
.cta-whatsapp { display: flex; align-items: center; justify-content: center; gap: 10px; background: #1f7a4d; color: #fff; padding: 16px; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; border: none; cursor: pointer; text-decoration: none; }
.cta-call { display: flex; align-items: center; justify-content: center; gap: 10px; background: transparent; color: var(--ink); padding: 15px; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; border: 1.5px solid var(--ink); cursor: pointer; text-decoration: none; }

.vision-section { background: var(--ink); color: var(--bg); }
.vision-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; }
.vision-inner { max-width: 620px; }
.vision-section .eyebrow { color: #d9b98a; }
.vision-image { position: relative; aspect-ratio: 4/5; background: #1a1a18; border: 1px solid #2a2a28; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.vision-image .glyph { font-size: 90px; opacity: 0.35; }
.vision-image-label { position: absolute; bottom: 18px; left: 18px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.55); }
@media (max-width: 900px) { .vision-grid { grid-template-columns: 1fr; gap: 34px; } .vision-image { order: 1; aspect-ratio: 16/10; } }
.vision-text { margin-top: 22px; font-size: 18px; line-height: 1.85; color: rgba(255,255,255,0.82); max-width: 680px; }

footer { background: var(--footer-bg); color: var(--footer-ink); padding: 80px 5vw 34px; }
.footer-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 40px; }
.footer-identity { text-align: center; }
.footer-mark { font-size: 24px; font-weight: 800; }
.footer-mark span { color: var(--accent); }
footer p { color: var(--footer-muted); font-size: 13px; line-height: 1.6; max-width: 280px; margin: 6px auto 0; }
.footer-col h4 { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--footer-muted); margin-bottom: 16px; }
.footer-col a { display: block; color: var(--footer-ink); opacity: 0.9; text-decoration: none; font-size: 13.5px; margin-bottom: 11px; cursor: pointer; }
.footer-bottom { margin-top: 60px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 11.5px; color: var(--footer-muted); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; }

@media (max-width: 900px) {
  .hero-grid { grid-template-columns: 1fr; }
  .hero-visual { order: -1; aspect-ratio: 16/10; }
  /* "Grandes vignettes" = une seule, en pleine largeur, par ligne sur mobile ; "Petites
     vignettes" = deux par ligne, plus compactes (distinction demandée le 2026-08-09). */
  .grid { grid-template-columns: repeat(1,1fr); }
  .grid.petite { grid-template-columns: repeat(2,1fr); }
  .card, .grid.petite .card { grid-column: span 1; }
  .ad-slot { grid-column: span 1; }
  .grid.petite .ad-slot { grid-column: span 2; }
  .card-media { aspect-ratio: 5/4; }
  .grid.petite .card-media { aspect-ratio: 1/1; }
  .card-media .glyph { font-size: 56px; }
  .grid.petite .card-media .glyph { font-size: 40px; }
  .footer-grid { grid-template-columns: 1fr 1fr; }
}

/* Hero compact sur mobile (demande du 2026-08-09) : occupait tout l'écran, texte trop grand. */
@media (max-width: 640px) {
  .hero { min-height: auto; padding: 90px 6vw 32px; }
  .hero-grid { gap: 22px; padding-top: 0; }
  .hero h1 { font-size: 38px; margin-top: 10px; }
  .hero p.lead { font-size: 14.5px; margin-top: 14px; }
  .hero-badge { margin-top: 12px; }
  .hero-cta { margin-top: 20px; }
  .hero-visual { aspect-ratio: 16/11; }
  .hero-frame .glyph { font-size: 80px; }
  .scroll-cue { display: none; }
  /* Le diaporama et le bandeau promo sont figés sur mobile (un seul visuel) : les points de
     navigation ne servent plus à rien et gênaient la vue. */
  .hero-dots, .banner-dots { display: none; }
  .hero-tag { left: 6vw; bottom: -14px; padding: 12px 16px; font-size: 11px; }
  .hero-tag b { font-size: 17px; }
  .vision-text { font-size: 14.5px; line-height: 1.55; margin-top: 14px; }
  .section { padding: 60px 6vw; }
}
`;
