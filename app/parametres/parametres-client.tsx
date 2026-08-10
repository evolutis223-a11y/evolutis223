"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { AppShell, type ShellModule } from "@/components/app-shell";
import { DocumentPreview } from "@/components/documents/document-preview";
import { enregistrerMastheadTexte, type ExempleDocument } from "./actions";
import { enregistrerContenuSiteWeb, type SiteBannerSlide, type SiteContenu, type SiteHeroSlide } from "@/app/site/actions";

const TABS = [
  { key: "apparence", label: "Général" },
  { key: "modeles", label: "Modèles de documents" },
  { key: "categories", label: "Catégories d'articles" },
  { key: "site", label: "Site & Marketing" },
  { key: "support", label: "Support & bugs" },
  { key: "guide", label: "Documentation" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const MODELE_TYPES = [
  { key: "facture", label: "Facture" },
  { key: "proforma", label: "Proforma" },
  { key: "devis", label: "Devis" },
  { key: "recu", label: "Reçu" },
  { key: "bl", label: "Bon de livraison" },
  { key: "bc", label: "Bon de commande" },
  { key: "recucaisse", label: "Reçu de caisse" },
  { key: "fichepaie", label: "Fiche de paie" },
  { key: "demission", label: "Lettre de démission" },
  { key: "entete", label: "En-tête vierge" },
  { key: "courrier", label: "Courrier" },
  { key: "ordremission", label: "Ordre de mission" },
  { key: "ticket", label: "Ticket" },
] as const;
type ModeleKey = (typeof MODELE_TYPES)[number]["key"];

export function ParametresClient({
  userName,
  roleLibelle,
  modules,
  roleCode,
  masthead,
  exemples,
  contenuSite,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  roleCode: string;
  masthead: string;
  exemples: { facture: ExempleDocument | null; devis: ExempleDocument | null; proforma: ExempleDocument | null; bc: ExempleDocument | null; bl: ExempleDocument | null };
  contenuSite: SiteContenu;
}) {
  const [tab, setTab] = useState<TabKey>("modeles");

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Paramètres" modules={modules}>
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Paramètres</div>
        <div style={{ display: "flex", gap: 6, background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 4, marginBottom: 22, width: "fit-content", flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{ background: tab === t.key ? "#3b82f6" : "transparent", color: tab === t.key ? "#fff" : "#888", border: "none", padding: "9px 16px", borderRadius: 6, fontSize: 13, cursor: "pointer" }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "modeles" ? (
          <ModelesDeDocuments roleCode={roleCode} mastheadInitial={masthead} exemples={exemples} />
        ) : tab === "site" ? (
          <SiteWebEditor contenuInitial={contenuSite} />
        ) : (
          <div style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: 20, color: "#888", fontSize: 13.5 }}>
            Onglet pas encore construit.
          </div>
        )}
      </div>
    </AppShell>
  );
}

function SiteWebEditor({ contenuInitial }: { contenuInitial: SiteContenu }) {
  const [contenu, setContenu] = useState<SiteContenu>(contenuInitial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function set<K extends keyof SiteContenu>(key: K, value: SiteContenu[K]) {
    setContenu((c) => ({ ...c, [key]: value }));
    setSaved(false);
  }

  function updateHeroSlide(i: number, patch: Partial<SiteHeroSlide>) {
    setContenu((c) => ({ ...c, heroSlides: c.heroSlides.map((s, si) => (si === i ? { ...s, ...patch } : s)) }));
    setSaved(false);
  }

  function updateUniversCard(i: number, patch: { glyph?: string; label?: string }) {
    setContenu((c) => ({ ...c, universCards: c.universCards.map((u, ui) => (ui === i ? { ...u, ...patch } : u)) }));
    setSaved(false);
  }

  function updateBannerSlide(i: number, patch: Partial<SiteBannerSlide>) {
    setContenu((c) => ({ ...c, bannerSlides: c.bannerSlides.map((s, si) => (si === i ? { ...s, ...patch } : s)) }));
    setSaved(false);
  }

  function ajouterBanniere() {
    setContenu((c) => ({ ...c, bannerSlides: [...c.bannerSlides, { tag: "Annonce", texte: "", bg: "#0b0b0b" }] }));
    setSaved(false);
  }

  function retirerBanniere(i: number) {
    setContenu((c) => ({ ...c, bannerSlides: c.bannerSlides.filter((_, si) => si !== i) }));
    setSaved(false);
  }

  async function enregistrer() {
    setSaving(true);
    setErreur(null);
    const res = await enregistrerContenuSiteWeb(contenu);
    setSaving(false);
    if (res.error) {
      setErreur(res.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Site web public (evolutis223.com/site)</div>
          <div style={{ fontSize: 12.5, color: "#888", marginTop: 3 }}>
            Modifiez les textes affichés sur le site sans toucher au code. Les produits affichés viennent automatiquement du catalogue.
          </div>
        </div>
        <a
          href="/site"
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 12.5, fontWeight: 700, color: "#3b82f6", textDecoration: "none", border: "1px solid #3b82f6", padding: "8px 14px", borderRadius: 6, whiteSpace: "nowrap" }}
        >
          Voir le site ↗
        </a>
      </div>

      <SiteSection titre="Thème">
        <div style={{ fontSize: 12.5, color: "#888", marginBottom: 12 }}>
          S'applique à tous les visiteurs du site — ce n'est pas un choix laissé au client.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => set("theme", "light")}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 6,
              border: contenu.theme === "light" ? "2px solid #3b82f6" : "1px solid #3a3a3a",
              background: contenu.theme === "light" ? "#1e293b" : "#141414",
              color: "#eee",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ☀ Clair
          </button>
          <button
            onClick={() => set("theme", "dark")}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 6,
              border: contenu.theme === "dark" ? "2px solid #3b82f6" : "1px solid #3a3a3a",
              background: contenu.theme === "dark" ? "#1e293b" : "#141414",
              color: "#eee",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🌙 Sombre
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: "#888", margin: "16px 0 8px" }}>Couleur de marque</div>
        <div style={{ display: "flex", gap: 10 }}>
          {(
            [
              { valeur: "or" as const, label: "🟤 Or", couleur: "#a8763e" },
              { valeur: "vert" as const, label: "🟢 Vert", couleur: "#4f7a52" },
              { valeur: "noir" as const, label: "⚫ Noir & Blanc", couleur: "#171716" },
            ]
          ).map((a) => (
            <button
              key={a.valeur}
              onClick={() => set("accent", a.valeur)}
              style={{
                flex: 1,
                padding: "12px 10px",
                borderRadius: 6,
                border: contenu.accent === a.valeur ? "2px solid #3b82f6" : "1px solid #3a3a3a",
                background: contenu.accent === a.valeur ? "#1e293b" : "#141414",
                color: "#eee",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </SiteSection>

      <SiteSection titre="Accroche">
        <SiteChamp label="Texte au-dessus du titre (ex. Fabriqué à Bamako)">
          <input style={siteInputStyle} value={contenu.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} />
        </SiteChamp>
        <SiteChamp label="Texte d'introduction (sous le titre)">
          <textarea style={{ ...siteInputStyle, height: 70, resize: "vertical" }} value={contenu.leadText} onChange={(e) => set("leadText", e.target.value)} />
        </SiteChamp>
        <div style={{ display: "flex", gap: 12 }}>
          <SiteChamp label="Chiffre (ex. 10+)" style={{ flex: 1 }}>
            <input style={siteInputStyle} value={contenu.badgeAnnees} onChange={(e) => set("badgeAnnees", e.target.value)} />
          </SiteChamp>
          <SiteChamp label="Légende (ex. ans d'expérience)" style={{ flex: 2 }}>
            <input style={siteInputStyle} value={contenu.badgeLabel} onChange={(e) => set("badgeLabel", e.target.value)} />
          </SiteChamp>
        </div>
      </SiteSection>

      <SiteSection titre="Diaporama d'accueil (défile automatiquement)">
        {contenu.heroSlides.map((s, i) => (
          <div
            key={i}
            style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 10, paddingBottom: 10, borderBottom: i < contenu.heroSlides.length - 1 ? "1px solid #2a2a2a" : "none" }}
          >
            <SiteChamp label="Icône" style={{ width: 70 }}>
              <input style={siteInputStyle} value={s.glyph} onChange={(e) => updateHeroSlide(i, { glyph: e.target.value })} />
            </SiteChamp>
            <SiteChamp label="Étiquette" style={{ flex: 1 }}>
              <input style={siteInputStyle} value={s.tag} onChange={(e) => updateHeroSlide(i, { tag: e.target.value })} />
            </SiteChamp>
            <SiteChamp label="Texte en gras" style={{ flex: 2 }}>
              <input style={siteInputStyle} value={s.bold} onChange={(e) => updateHeroSlide(i, { bold: e.target.value })} />
            </SiteChamp>
          </div>
        ))}
      </SiteSection>

      <SiteSection titre="Bandeau promo (défile automatiquement)">
        {contenu.bannerSlides.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #2a2a2a" }}>
            <SiteChamp label="Étiquette" style={{ width: 110 }}>
              <input style={siteInputStyle} value={s.tag} onChange={(e) => updateBannerSlide(i, { tag: e.target.value })} />
            </SiteChamp>
            <SiteChamp label="Message" style={{ flex: 1 }}>
              <input style={siteInputStyle} value={s.texte} onChange={(e) => updateBannerSlide(i, { texte: e.target.value })} />
            </SiteChamp>
            <SiteChamp label="Couleur" style={{ width: 60 }}>
              <input type="color" style={{ ...siteInputStyle, padding: 2, height: 34 }} value={s.bg} onChange={(e) => updateBannerSlide(i, { bg: e.target.value })} />
            </SiteChamp>
            <button
              onClick={() => retirerBanniere(i)}
              title="Retirer ce message"
              style={{ background: "none", border: "1px solid #444", color: "#f87171", borderRadius: 6, width: 34, height: 34, cursor: "pointer", flexShrink: 0 }}
            >
              ×
            </button>
          </div>
        ))}
        <button onClick={ajouterBanniere} style={{ background: "none", border: "1px dashed #444", color: "#93c5fd", borderRadius: 6, padding: "8px 14px", fontSize: 12.5, cursor: "pointer" }}>
          + Ajouter un message
        </button>
      </SiteSection>

      <SiteSection titre="Nos univers">
        {contenu.universCards.map((u, i) => (
          <div key={u.marque} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 10 }}>
            <div style={{ width: 90, fontSize: 12.5, fontWeight: 700, color: "#ccc", paddingBottom: 9, flexShrink: 0 }}>{u.marque}</div>
            <SiteChamp label="Icône" style={{ width: 70 }}>
              <input style={siteInputStyle} value={u.glyph} onChange={(e) => updateUniversCard(i, { glyph: e.target.value })} />
            </SiteChamp>
            <SiteChamp label="Description" style={{ flex: 1 }}>
              <input style={siteInputStyle} value={u.label} onChange={(e) => updateUniversCard(i, { label: e.target.value })} />
            </SiteChamp>
          </div>
        ))}
      </SiteSection>

      <SiteSection titre="Notre vision">
        <div style={{ display: "flex", gap: 12 }}>
          <SiteChamp label="Titre — 1ère ligne" style={{ flex: 1 }}>
            <input style={siteInputStyle} value={contenu.visionTitreLigne1} onChange={(e) => set("visionTitreLigne1", e.target.value)} />
          </SiteChamp>
          <SiteChamp label="Titre — 2e ligne" style={{ flex: 1 }}>
            <input style={siteInputStyle} value={contenu.visionTitreLigne2} onChange={(e) => set("visionTitreLigne2", e.target.value)} />
          </SiteChamp>
        </div>
        <SiteChamp label="Texte">
          <textarea style={{ ...siteInputStyle, height: 110, resize: "vertical" }} value={contenu.visionText} onChange={(e) => set("visionText", e.target.value)} />
        </SiteChamp>
      </SiteSection>

      <SiteSection titre="Pied de page">
        <SiteChamp label="Texte de présentation">
          <textarea style={{ ...siteInputStyle, height: 70, resize: "vertical" }} value={contenu.footerTagline} onChange={(e) => set("footerTagline", e.target.value)} />
        </SiteChamp>
      </SiteSection>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6 }}>
        <button
          onClick={enregistrer}
          disabled={saving}
          style={{ background: "#3b82f6", color: "#fff", border: "none", padding: "11px 22px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
        {saved && <span style={{ color: "#34d399", fontSize: 13, fontWeight: 700 }}>✓ Enregistré</span>}
        {erreur && <span style={{ color: "#f87171", fontSize: 13 }}>{erreur}</span>}
      </div>
    </div>
  );
}

function SiteSection({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: 18, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.04em" }}>{titre}</div>
      {children}
    </div>
  );
}

function SiteChamp({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10, ...style }}>
      <label style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
      {children}
    </div>
  );
}

const siteInputStyle: CSSProperties = { background: "#141414", border: "1px solid #3a3a3a", color: "#eee", borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "inherit" };

function ModelesDeDocuments({
  roleCode,
  mastheadInitial,
  exemples,
}: {
  roleCode: string;
  mastheadInitial: string;
  exemples: { facture: ExempleDocument | null; devis: ExempleDocument | null; proforma: ExempleDocument | null; bc: ExempleDocument | null; bl: ExempleDocument | null };
}) {
  const [type, setType] = useState<ModeleKey>("facture");
  const [editMode, setEditMode] = useState(false);
  const [masthead, setMasthead] = useState(mastheadInitial);
  const [saving, setSaving] = useState(false);

  async function handleSaveMasthead(texte: string) {
    setSaving(true);
    await enregistrerMastheadTexte(texte);
    setSaving(false);
  }

  return (
    <div style={{ display: "flex", gap: 20, height: "calc(100vh - 260px)", minHeight: 500 }}>
      <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
        {MODELE_TYPES.map((m) => (
          <button
            key={m.key}
            onClick={() => setType(m.key)}
            style={{ textAlign: "left", background: type === m.key ? "#3b82f6" : "#1e1e1e", color: type === m.key ? "#fff" : "#ccc", border: "none", padding: "11px 14px", borderRadius: 6, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
        <div style={{ maxWidth: 760, margin: "0 auto 10px", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => setEditMode((v) => !v)}
            style={{ background: editMode ? "#3b82f6" : "none", color: editMode ? "#fff" : "#93c5fd", border: "1px solid #3b82f6", padding: "7px 14px", borderRadius: 6, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
          >
            {editMode ? "✓ Terminé" : "✏️ Modifier ce modèle"}
          </button>
        </div>
        <div style={{ background: "#fff", color: "#000", border: "1px solid #444", padding: 24, fontFamily: "Arial,sans-serif", fontSize: 13, width: 794, maxWidth: "100%", boxSizing: "border-box", margin: "0 auto", position: "relative" }}>
          {type === "recu" && <ModeleRecu />}
          {type === "recucaisse" && <ModeleRecuCaisse masthead={masthead} editMode={editMode} onChange={setMasthead} onSave={handleSaveMasthead} saving={saving} />}
          {type === "fichepaie" && <ModeleFichePaie masthead={masthead} editMode={editMode} onChange={setMasthead} onSave={handleSaveMasthead} saving={saving} />}
          {type === "demission" && <ModeleDemission masthead={masthead} editMode={editMode} onChange={setMasthead} onSave={handleSaveMasthead} saving={saving} />}
          {type === "entete" && <ModeleEntete masthead={masthead} editMode={editMode} onChange={setMasthead} onSave={handleSaveMasthead} saving={saving} />}
          {type === "courrier" && <ModeleCourrier masthead={masthead} editMode={editMode} onChange={setMasthead} onSave={handleSaveMasthead} saving={saving} />}
          {type === "ordremission" && <ModeleOrdreMission masthead={masthead} editMode={editMode} onChange={setMasthead} onSave={handleSaveMasthead} saving={saving} />}
          {type === "ticket" && <ModeleTicket masthead={masthead} editMode={editMode} onChange={setMasthead} onSave={handleSaveMasthead} saving={saving} />}
          {type === "bc" &&
            (exemples.bc ? (
              <DocumentPreview data={exemples.bc} masthead={masthead} editMode={editMode} onMastheadChange={setMasthead} onMastheadSave={handleSaveMasthead} />
            ) : (
              <AucunExemple type="Bon de commande" />
            ))}
          {type === "bl" &&
            (exemples.bl ? (
              <DocumentPreview data={exemples.bl} masthead={masthead} editMode={editMode} onMastheadChange={setMasthead} onMastheadSave={handleSaveMasthead} />
            ) : (
              <AucunExemple type="Bon de livraison" />
            ))}
          {type === "facture" &&
            (exemples.facture ? (
              <DocumentPreview data={exemples.facture} masthead={masthead} editMode={editMode} onMastheadChange={setMasthead} onMastheadSave={handleSaveMasthead} />
            ) : (
              <AucunExemple type="Facture" />
            ))}
          {type === "proforma" &&
            (exemples.proforma ? (
              <DocumentPreview data={exemples.proforma} masthead={masthead} editMode={editMode} onMastheadChange={setMasthead} onMastheadSave={handleSaveMasthead} />
            ) : (
              <AucunExemple type="Proforma" />
            ))}
          {type === "devis" &&
            (exemples.devis ? (
              <DocumentPreview data={exemples.devis} masthead={masthead} editMode={editMode} onMastheadChange={setMasthead} onMastheadSave={handleSaveMasthead} />
            ) : (
              <AucunExemple type="Devis" />
            ))}
        </div>
        {type === "recu" && (
          <p style={{ maxWidth: 760, margin: "10px auto 0", textAlign: "center", fontSize: 11.5, color: "#666" }}>
            Ce modèle n&apos;a pas de pied de page (pas de mentions légales sur un reçu de paiement simple).
          </p>
        )}
      </div>
    </div>
  );
}

// ---- Modèle Reçu (générique, non lié à une affaire) ----
function ModeleRecu() {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "3px solid #000", paddingBottom: 14, marginBottom: 20 }}>
        <img src="/logo.png" alt="" style={{ height: 38, width: 132 }} />
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "0.02em" }}>REÇU</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 22 }}>
        <div>
          <b>N°</b> ______
        </div>
        <div>
          <b>Date</b> __/__/____
        </div>
      </div>
      <div style={{ display: "flex", gap: 34, alignItems: "stretch", marginBottom: 20 }}>
        <div style={{ flex: 1.15, display: "flex", flexDirection: "column", justifyContent: "space-around", fontSize: 14, lineHeight: 1.5 }}>
          <div>
            <span style={{ color: "#666", fontSize: 11, textTransform: "uppercase", display: "block" }}>Reçu de</span>
            <b>________________________</b>
          </div>
          <div>
            <span style={{ color: "#666", fontSize: 11, textTransform: "uppercase", display: "block" }}>Pour</span>________________________
          </div>
          <div>
            <span style={{ color: "#666", fontSize: 11, textTransform: "uppercase", display: "block" }}>Mode de règlement</span>☐ Espèces ☐ Mobile Money ☐ Virement ☐ Chèque
          </div>
          <div>
            <span style={{ color: "#666", fontSize: 11, textTransform: "uppercase", display: "block" }}>Reçu par</span>________________________
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", borderLeft: "2px solid #000", paddingLeft: 34 }}>
          <span style={{ color: "#666", fontSize: 11, textTransform: "uppercase" }}>Montant reçu</span>
          <div style={{ fontSize: 36, fontWeight: 800, margin: "8px 0" }}>____________ F</div>
          <div style={{ fontSize: 11.5, textAlign: "center", color: "#444", fontStyle: "italic" }}>________________________________ francs CFA</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, fontStyle: "italic", color: "#333" }}>Merci pour votre confiance.</div>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=EVOLUTIS223" alt="QR" style={{ width: 60, height: 60 }} />
      </div>
    </>
  );
}

// ---- Modèle Reçu de caisse (générique) ----
function ModeleRecuCaisse({ masthead, editMode, onChange, onSave, saving }: MastheadEditProps) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "3px solid #000", paddingBottom: 14, marginBottom: 20 }}>
        <img src="/logo.png" alt="" style={{ height: 34, width: 118 }} />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Reçu de caisse</div>
          <div style={{ fontSize: 10.5, color: "#444" }}>N° ______ — __/__/____ __:__</div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10 }}>
        <tbody>
          <tr style={{ background: "#000", color: "#fff" }}>
            <th style={{ padding: 6, textAlign: "left" }}>Article</th>
            <th style={{ padding: 6, textAlign: "center" }}>Qté</th>
            <th style={{ padding: 6, textAlign: "right" }}>Total</th>
          </tr>
          {[1, 2, 3].map((i) => (
            <tr key={i}>
              <td style={{ padding: "8px 6px", borderBottom: "1px solid #ddd" }}>&nbsp;</td>
              <td style={{ padding: "8px 6px", borderBottom: "1px solid #ddd", textAlign: "center" }}>&nbsp;</td>
              <td style={{ padding: "8px 6px", borderBottom: "1px solid #ddd", textAlign: "right" }}>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }} />
        <div style={{ flex: 1, minWidth: 0, fontSize: 13, border: "1px solid #000" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px" }}>
            <span>SOUS-TOTAL</span>
            <span>____________</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px" }}>
            <span>REMISE</span>
            <span>—</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px" }}>
            <span>TOTAL HT</span>
            <span>____________</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px" }}>
            <span>TVA (0%)</span>
            <span>____________</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", borderTop: "2px solid #000", fontWeight: 800, fontSize: 15 }}>
            <span>TOTAL TTC</span>
            <span>____________ F</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px", color: "#b91c1c", fontWeight: 700, borderTop: "1px solid #000" }}>
            <span>SOLDE</span>
            <span>____________ F</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11.5, fontStyle: "italic", color: "#333" }}>Merci pour votre confiance.</div>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=EVOLUTIS223" alt="QR" style={{ width: 56, height: 56 }} />
      </div>
      <MastheadFooter masthead={masthead} editMode={editMode} onChange={onChange} onSave={onSave} saving={saving} />
    </>
  );
}

// ---- Modèle Fiche de paie (générique) ----
function ModeleFichePaie({ masthead, editMode, onChange, onSave, saving }: MastheadEditProps) {
  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, padding: "8px 8px 8px 0", display: "flex", alignItems: "center" }}>
          <img src="/logo.png" alt="" style={{ height: 55, width: 191 }} />
        </div>
        <div style={{ flex: 1, padding: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 32, fontWeight: 800 }}>Bulletin de paie</div>
            <div style={{ fontSize: 9, marginTop: 4 }}>Période : __________ — Émis le __/__/____</div>
          </div>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=EVOLUTIS223" alt="QR" style={{ width: 52, height: 52, flexShrink: 0 }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, padding: 14, fontSize: 13 }}>
          <b>Employé :</b> ________________________
          <br />
          Matricule : ______
          <br />
          Poste : ________________________
        </div>
        <div style={{ flex: 1, padding: 14, fontSize: 13 }}>
          <b>EVOLUTIS223</b>
          <br />
          Badalabougou, Rue 90, Porte 307
          <br />
          N°RCCM: MA.BKO.2022.A03394
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10 }}>
        <tbody>
          <tr style={{ background: "#000", color: "#fff" }}>
            <th style={{ border: "1px solid #000", padding: 5, textAlign: "left", width: "52%" }}>Désignation</th>
            <th style={{ border: "1px solid #000", padding: 5, width: "24%" }}>Base</th>
            <th style={{ border: "1px solid #000", padding: 5, width: "24%" }}>Montant</th>
          </tr>
          {["Salaire de base", "Primes", "Retenue INPS"].map((l) => (
            <tr key={l}>
              <td style={{ border: "1px solid #000", padding: 9 }}>{l}</td>
              <td style={{ border: "1px solid #000", textAlign: "center" }}>—</td>
              <td style={{ border: "1px solid #000", textAlign: "right", padding: "0 6px" }}>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <div style={{ width: 260, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
            <span>SALAIRE BRUT</span>
            <span>____________</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
            <span>RETENUES</span>
            <span>____________</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderTop: "2px solid #000", fontWeight: 800, fontSize: 16 }}>
            <span>NET À PAYER</span>
            <span>____________ F</span>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12, marginBottom: 16 }}>
        <b>Mode de paiement :</b> ________________________
      </div>
      <MastheadFooter masthead={masthead} editMode={editMode} onChange={onChange} onSave={onSave} saving={saving} />
    </>
  );
}

// ---- Modèle Lettre de démission ----
function ModeleDemission({ masthead, editMode, onChange, onSave, saving }: MastheadEditProps) {
  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, padding: "8px 8px 8px 0", display: "flex", alignItems: "center" }}>
          <img src="/logo.png" alt="" style={{ height: 50, width: 174 }} />
        </div>
        <div style={{ flex: 1, padding: 8, textAlign: "right", fontSize: 12, color: "#555" }}>Bamako, le __/__/____</div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, textAlign: "center", marginBottom: 20 }}>Lettre de démission</div>
      <div style={{ fontSize: 13, marginBottom: 16 }}>
        <b>Destinataire :</b> Direction — EVOLUTIS223
        <br />
        <b>Objet :</b> Notification de démission
      </div>
      <div style={{ fontFamily: "Georgia,'Times New Roman',serif", fontSize: 13, lineHeight: 1.7, color: "#1a1a1a" }}>
        <p>Madame, Monsieur,</p>
        <p>
          Je soussigné(e) ________________________, Matricule ______, occupant le poste de ________________________ au sein d&apos;EVOLUTIS223, vous informe
          par la présente de ma décision de démissionner de mon poste.
        </p>
        <p>Conformément au délai de préavis prévu par mon contrat, ma date de départ effective sera fixée au __/__/____.</p>
        <p>
          Je reste à votre disposition pour assurer la passation de mes dossiers en cours et vous prie d&apos;agréer, Madame, Monsieur, l&apos;expression de mes
          salutations distinguées.
        </p>
      </div>
      <div style={{ marginTop: 36, marginBottom: 16, textAlign: "right", fontSize: 13 }}>
        <div style={{ fontWeight: 700 }}>________________________</div>
        <div style={{ color: "#555" }}>L&apos;Employé(e)</div>
      </div>
      <MastheadFooter masthead={masthead} editMode={editMode} onChange={onChange} onSave={onSave} saving={saving} />
    </>
  );
}

interface MastheadEditProps {
  masthead: string;
  editMode: boolean;
  onChange: (v: string) => void;
  onSave: (v: string) => void;
  saving: boolean;
}

function MastheadFooter({ masthead, editMode, onChange, onSave, saving }: MastheadEditProps) {
  return (
    <div style={{ borderTop: "1px solid #000", paddingTop: 8 }}>
      {editMode ? (
        <textarea
          value={masthead}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onSave(e.target.value)}
          disabled={saving}
          style={{ width: "100%", height: 44, background: "#fff", border: "1px solid #999", color: "#333", fontFamily: "Arial,sans-serif", fontSize: 9, padding: 6, boxSizing: "border-box", textAlign: "center" }}
        />
      ) : (
        <div style={{ textAlign: "center", fontSize: 9.5, color: "#333", whiteSpace: "pre-line" }}>{masthead}</div>
      )}
    </div>
  );
}

// ---- Modèle En-tête vierge ----
function ModeleEntete({ masthead, editMode, onChange, onSave, saving }: { masthead: string; editMode: boolean; onChange: (v: string) => void; onSave: (v: string) => void; saving: boolean }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #000", paddingBottom: 12, marginBottom: 40 }}>
        <img src="/logo.png" alt="" style={{ height: 34, width: 118 }} />
        <div style={{ fontSize: 9, color: "#666" }}>Bamako, Mali</div>
      </div>
      <div style={{ minHeight: 520 }} />
      <MastheadFooter masthead={masthead} editMode={editMode} onChange={onChange} onSave={onSave} saving={saving} />
    </>
  );
}

// ---- Modèle Courrier ----
function ModeleCourrier({ masthead, editMode, onChange, onSave, saving }: { masthead: string; editMode: boolean; onChange: (v: string) => void; onSave: (v: string) => void; saving: boolean }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #000", paddingBottom: 12, marginBottom: 20 }}>
        <img src="/logo.png" alt="" style={{ height: 34, width: 118 }} />
        <div style={{ fontSize: 9, color: "#666" }}>Bamako, Mali</div>
      </div>
      <div style={{ fontFamily: "Georgia,'Times New Roman',serif", color: "#1a1a1a", fontSize: 13, lineHeight: 1.6 }}>
        <div style={{ textAlign: "right", marginBottom: 28 }}>Bamako, le __/__/____</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40 }}>
          <div style={{ fontSize: 13.5 }}>
            <b>Destinataire :</b>
            <br />
            ________________________
            <br />
            ________________________
            <br />À l&apos;attention de ________________________
          </div>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=EVOLUTIS223" alt="QR" style={{ width: 52, height: 52, flexShrink: 0 }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <b>Objet :</b> ________________________
        </div>
        <p>Madame, Monsieur,</p>
        <p>[Corps du courrier — texte à rédiger selon le contexte.]</p>
        <p>Nous restons à votre disposition pour toute information complémentaire et vous prions d&apos;agréer, Madame, Monsieur, l&apos;expression de nos salutations distinguées.</p>
        <div style={{ marginTop: 40, marginBottom: 20, textAlign: "right" }}>
          <div style={{ height: 50 }} />
          <div style={{ fontWeight: 700 }}>________________________</div>
          <div style={{ fontSize: 11.5, color: "#555" }}>________________________</div>
        </div>
      </div>
      <MastheadFooter masthead={masthead} editMode={editMode} onChange={onChange} onSave={onSave} saving={saving} />
    </>
  );
}

// ---- Modèle Ordre de mission ----
function ModeleOrdreMission({ masthead, editMode, onChange, onSave, saving }: MastheadEditProps) {
  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, padding: "8px 8px 8px 0", display: "flex", alignItems: "center" }}>
          <img src="/logo.png" alt="" style={{ height: 55, width: 191 }} />
        </div>
        <div style={{ flex: 1, padding: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 32, fontWeight: 800 }}>Ordre de mission</div>
            <div style={{ fontSize: 9, marginTop: 4 }}>N° ______ — __/__/____</div>
          </div>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=EVOLUTIS223" alt="QR" style={{ width: 52, height: 52, flexShrink: 0 }} />
        </div>
      </div>
      <div style={{ padding: "0 14px", fontSize: 13, marginBottom: 10 }}>
        <b>Objet :</b> ________________________
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10 }}>
        <tbody>
          <tr style={{ background: "#000", color: "#fff" }}>
            <th style={{ border: "1px solid #000", padding: 5, textAlign: "left", width: "12%" }}>Rôle</th>
            <th style={{ border: "1px solid #000", padding: 5, textAlign: "left", width: "38%" }}>Nom</th>
            <th style={{ border: "1px solid #000", padding: 5, textAlign: "left", width: "18%" }}>Matricule</th>
            <th style={{ border: "1px solid #000", padding: 5, textAlign: "left", width: "32%" }}>Poste</th>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: 8, fontWeight: 700 }}>Chef de mission</td>
            <td style={{ border: "1px solid #000" }}>&nbsp;</td>
            <td style={{ border: "1px solid #000" }}>&nbsp;</td>
            <td style={{ border: "1px solid #000" }}>&nbsp;</td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: 8 }}>Membre</td>
            <td style={{ border: "1px solid #000" }}>&nbsp;</td>
            <td style={{ border: "1px solid #000" }}>&nbsp;</td>
            <td style={{ border: "1px solid #000" }}>&nbsp;</td>
          </tr>
        </tbody>
      </table>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
        <tbody>
          <tr style={{ background: "#000", color: "#fff" }}>
            <th style={{ border: "1px solid #000", padding: 6, textAlign: "left", width: "30%" }}>Détail</th>
            <th style={{ border: "1px solid #000", padding: 6, textAlign: "left" }}>Information</th>
          </tr>
          {["Destination", "Date de départ", "Date de retour", "Moyen de transport", "Frais avancés"].map((l) => (
            <tr key={l}>
              <td style={{ border: "1px solid #000", padding: 9, fontWeight: 700 }}>{l}</td>
              <td style={{ border: "1px solid #000", padding: 9 }}>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 12, marginBottom: 16 }}>
        <b>Instructions :</b> ________________________
      </div>
      <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <span style={{ fontStyle: "italic", fontSize: 15, fontWeight: 700, textDecoration: "underline" }}>Le Chef de mission</span>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontStyle: "italic", fontSize: 15, fontWeight: 700, textDecoration: "underline" }}>Pour EVOLUTIS223</div>
          <div style={{ position: "relative", width: 104, marginLeft: "auto", marginTop: 2 }}>
            <img src="/cachet.png" alt="" style={{ height: 102, display: "block", width: 104 }} />
            <img src="/signature.png" alt="" style={{ height: 176, position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }} />
          </div>
        </div>
      </div>
      <MastheadFooter masthead={masthead} editMode={editMode} onChange={onChange} onSave={onSave} saving={saving} />
    </>
  );
}

// ---- Modèle Ticket (nouveau — usage futur : promotions, offres... § décision utilisateur 2026-08-04) ----
function ModeleTicket({ masthead, editMode, onChange, onSave, saving }: MastheadEditProps) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "3px solid #000", paddingBottom: 14, marginBottom: 20 }}>
        <img src="/logo.png" alt="" style={{ height: 38, width: 132 }} />
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "0.02em" }}>TICKET</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 22 }}>
        <div>
          <b>N°</b> ______
        </div>
        <div>
          <b>Date</b> __/__/____
        </div>
      </div>
      <div style={{ fontSize: 14, marginBottom: 20 }}>
        <span style={{ color: "#666", fontSize: 11, textTransform: "uppercase", display: "block" }}>Libellé</span>
        ________________________
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed #999", borderRadius: 8, padding: 24, marginBottom: 20, color: "#888", fontStyle: "italic", fontSize: 12.5, textAlign: "center" }}>
        Modèle en réserve pour un usage futur (promotions, offres, etc.) — contenu à définir.
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, fontStyle: "italic", color: "#333" }}>Merci pour votre confiance.</div>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=EVOLUTIS223" alt="QR" style={{ width: 60, height: 60 }} />
      </div>
      <div style={{ marginTop: 10 }}>
        <MastheadFooter masthead={masthead} editMode={editMode} onChange={onChange} onSave={onSave} saving={saving} />
      </div>
    </>
  );
}

function AucunExemple({ type }: { type: string }) {
  return <div style={{ padding: 40, textAlign: "center", color: "#888", fontStyle: "italic" }}>Aucune affaire de type {type} pour l&apos;instant — exemple non disponible.</div>;
}
