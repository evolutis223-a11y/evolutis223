"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { parametresDocuments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { uploadFichier } from "@/lib/blob";

const TYPE_DOCUMENT = "SITE_WEB_CONTENU";

export interface SiteHeroSlide {
  glyph: string;
  imageUrl?: string;
  tag: string;
  bold: string;
}

export interface SiteBannerSlide {
  tag: string;
  texte: string;
  bg: string;
}

export interface SiteUniversCard {
  marque: "EvoluTex" | "EvoluCom" | "EvoluTech";
  glyph: string;
  label: string;
}

export interface SiteContenu {
  theme: "light" | "dark";
  accent: "or" | "vert" | "noir";
  logoClairUrl?: string;
  logoSombreUrl?: string;
  eyebrow: string;
  leadText: string;
  badgeAnnees: string;
  badgeLabel: string;
  heroSlides: SiteHeroSlide[];
  heroBoucle: boolean;
  bannerSlides: SiteBannerSlide[];
  universCards: SiteUniversCard[];
  visionTitreLigne1: string;
  visionTitreLigne2: string;
  visionText: string;
  footerTagline: string;
}

const SITE_CONTENU_DEFAUT: SiteContenu = {
  theme: "light",
  accent: "or",
  eyebrow: "Fabriqué à Bamako",
  leadText:
    "Tech · Com · Pub : EVOLUTIS223 conçoit des solutions textiles, créatives et numériques sur mesure, pensées pour porter vos idées plus loin.",
  badgeAnnees: "10+",
  badgeLabel: "ans d'expérience",
  heroSlides: [
    { glyph: "👕", tag: "Nouveau ce mois", bold: "Polo Standard" },
    { glyph: "🧵", tag: "Bientôt chez EvoluTex", bold: "Toute une gamme pour votre quotidien" },
    { glyph: "🎒", tag: "Bientôt la rentrée", bold: "Polos scolaires personnalisés" },
    { glyph: "🧣", tag: "Sur mesure", bold: "Pagne & textile personnalisés" },
  ],
  heroBoucle: true,
  bannerSlides: [
    { tag: "Soldes", texte: "Jusqu'à -20% sur une sélection cette semaine", bg: "#0b0b0b" },
    { tag: "Livraison", texte: "Livraison offerte à Bamako dès 3 pièces achetées", bg: "#a8763e" },
    { tag: "Nouveau", texte: "La ligne Survêtement vient d'arriver", bg: "#1f7a4d" },
    { tag: "Partenaire", texte: "Devenez revendeur EVOLUTIS223, écrivez-nous", bg: "#2a2a28" },
  ],
  universCards: [
    { marque: "EvoluTex", glyph: "🧵", label: "Textile & confection" },
    { marque: "EvoluCom", glyph: "☕", label: "Objets personnalisés" },
    { marque: "EvoluTech", glyph: "💻", label: "Solutions numériques" },
  ],
  visionTitreLigne1: "Le savoir-faire africain,",
  visionTitreLigne2: "à la hauteur du monde.",
  visionText:
    "Nous concevons des solutions pensées ici, au Mali, pour répondre aux réalités africaines : un « made in Afrique » exigeant, moderne et fiable. Chaque produit, chaque outil que nous créons vise à simplifier le quotidien, à faire gagner du temps et à créer de l'emploi local. Notre ambition : prouver que l'innovation textile, créative et numérique a toute sa place ici, portée par une équipe malienne.",
  footerTagline: "Tech · Com · Pub",
};

function fusionnerContenu(partiel: Partial<SiteContenu> | undefined): SiteContenu {
  if (!partiel) return SITE_CONTENU_DEFAUT;
  return { ...SITE_CONTENU_DEFAUT, ...partiel };
}

export async function chargerContenuSiteWeb(): Promise<SiteContenu> {
  const [row] = await db
    .select({ config: parametresDocuments.config })
    .from(parametresDocuments)
    .where(eq(parametresDocuments.typeDocument, TYPE_DOCUMENT))
    .limit(1);
  return fusionnerContenu(row?.config as Partial<SiteContenu> | undefined);
}

async function requireAdminAccess() {
  const session = await getSession();
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.roleCode)) {
    throw new Error("Accès refusé.");
  }
  return session;
}

export async function enregistrerContenuSiteWeb(contenu: SiteContenu): Promise<{ error?: string }> {
  try {
    const session = await requireAdminAccess();
    const [existing] = await db
      .select({ id: parametresDocuments.id })
      .from(parametresDocuments)
      .where(eq(parametresDocuments.typeDocument, TYPE_DOCUMENT))
      .limit(1);
    if (existing) {
      await db
        .update(parametresDocuments)
        .set({ config: contenu, modifiePar: session.userId, dateModification: new Date() })
        .where(eq(parametresDocuments.id, existing.id));
    } else {
      await db.insert(parametresDocuments).values({ typeDocument: TYPE_DOCUMENT, config: contenu, modifiePar: session.userId });
    }
    revalidatePath("/site");
    revalidatePath("/parametres");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur." };
  }
}

export async function uploaderImageHeroSite(file: File): Promise<{ url?: string; error?: string }> {
  try {
    await requireAdminAccess();
    const { url } = await uploadFichier(file, "site-hero");
    return { url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur d'envoi." };
  }
}

export async function uploaderLogoSite(file: File): Promise<{ url?: string; error?: string }> {
  try {
    await requireAdminAccess();
    const { url } = await uploadFichier(file, "site-logo");
    return { url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur d'envoi." };
  }
}
