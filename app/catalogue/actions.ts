"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { calculerPrixRevient, type CompositionCout } from "@/lib/calculateurs/coutRevient";

export interface CreateArticleState {
  error: string | null;
}

const FAMILLES = ["A", "B", "C", "D", "E"] as const;

export async function createArticle(
  _prevState: CreateArticleState,
  formData: FormData
): Promise<CreateArticleState> {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Catalogue")) {
    return { error: "Accès refusé." };
  }

  const code = String(formData.get("code") ?? "").trim();
  const nom = String(formData.get("nom") ?? "").trim();
  const famille = String(formData.get("famille") ?? "");
  const prixVente = String(formData.get("prixVente") ?? "").trim();
  const photoUrl = String(formData.get("photoUrl") ?? "").trim();
  const publieBoutique = formData.get("publieBoutique") === "on";
  const brancheIdRaw = String(formData.get("brancheId") ?? "").trim();
  const brancheId = brancheIdRaw ? Number(brancheIdRaw) : null;
  const categorieMarquageRaw = String(formData.get("categorieMarquage") ?? "").trim();
  const categorieMarquage =
    famille === "A" && ["ENSEMBLE", "TISSU"].includes(categorieMarquageRaw) ? categorieMarquageRaw : null;
  // Prix de revient (Famille C/D uniquement) — ces familles n'ont pas de lot d'approvisionnement
  // qui alimenterait pmp automatiquement (§4.3), donc saisie manuelle à la création. Décision
  // utilisateur 2026-08-02 (pagne industriel notamment) : suivre juste ce prix pour commencer,
  // le vrai système de gestion de production viendra plus tard.
  const prixRevientRaw = String(formData.get("prixRevient") ?? "").trim();
  const prixRevient = (famille === "C" || famille === "D") && prixRevientRaw ? Number(prixRevientRaw) : null;
  if (prixRevient !== null && (!Number.isFinite(prixRevient) || prixRevient < 0)) {
    return { error: "Prix de revient invalide." };
  }

  if (!nom) return { error: "Nom requis." };
  if (!FAMILLES.includes(famille as (typeof FAMILLES)[number])) {
    return { error: "Famille requise." };
  }
  // Défense en profondeur : le client préfixe déjà le code par la famille, mais on revalide
  // ici pour ne jamais dépendre uniquement du JS client (§ demande utilisateur 2026-07-28).
  if (!code.startsWith(`${famille}-`) || code === `${famille}-`) {
    return { error: "Code invalide — doit être préfixé par la famille (ex. A-061)." };
  }
  const prix = Number(prixVente);
  if (!Number.isFinite(prix) || prix < 0) return { error: "Prix de vente invalide." };

  const existing = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.code, code))
    .limit(1);
  if (existing.length > 0) return { error: `Le code ${code} existe déjà.` };

  await db.insert(articles).values({
    code,
    nom,
    famille,
    prixVente: prix.toFixed(2),
    pmp: prixRevient !== null ? prixRevient.toFixed(2) : "0",
    aVariantes: famille === "A",
    publieBoutique,
    photoUrl: photoUrl || null,
    brancheId,
    categorieMarquage,
  });

  revalidatePath("/catalogue");
  return { error: null };
}

export async function definirCategorieMarquage(articleId: number, categorie: "ENSEMBLE" | "TISSU" | null) {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Catalogue")) {
    throw new Error("Accès refusé.");
  }
  await db.update(articles).set({ categorieMarquage: categorie }).where(eq(articles.id, articleId));
  revalidatePath("/catalogue");
}

// Famille C/D uniquement — pmp normalement alimenté par les lots d'approvisionnement (§4.3),
// inexistants pour ces familles. Saisie manuelle du prix de revient (décision utilisateur
// 2026-08-02) — alimente aussi le coût d'achat des ventes dans /rapports (dimension Finance).
export async function definirPrixRevient(articleId: number, prixRevient: number) {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Catalogue")) {
    throw new Error("Accès refusé.");
  }
  if (!Number.isFinite(prixRevient) || prixRevient < 0) throw new Error("Prix de revient invalide.");
  await db.update(articles).set({ pmp: prixRevient.toFixed(2) }).where(eq(articles.id, articleId));
  revalidatePath("/catalogue");
}

// Calculateur de coût de revient (matières + main-d'œuvre + autres frais + marge) — remplace la
// simple saisie manuelle de pmp par un vrai détail traçable, figé sur l'article pour audit.
export async function definirPrixRevientCalcule(articleId: number, composition: CompositionCout) {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Catalogue")) {
    throw new Error("Accès refusé.");
  }
  const prixRevient = calculerPrixRevient(composition);
  if (!Number.isFinite(prixRevient) || prixRevient < 0) throw new Error("Composition invalide.");
  await db
    .update(articles)
    .set({ pmp: prixRevient.toFixed(2), compositionCout: composition })
    .where(eq(articles.id, articleId));
  revalidatePath("/catalogue");
  return prixRevient;
}

export async function togglePublieBoutique(articleId: number, next: boolean) {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Catalogue")) {
    throw new Error("Accès refusé.");
  }
  await db.update(articles).set({ publieBoutique: next }).where(eq(articles.id, articleId));
  revalidatePath("/catalogue");
}

// Famille E (Kit) uniquement — décide si la vente déclenche un Ordre de Fabrication (§8.1 point 4).
export async function toggleNecessiteAssemblage(articleId: number, next: boolean) {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Catalogue")) {
    throw new Error("Accès refusé.");
  }
  await db.update(articles).set({ necessiteAssemblage: next }).where(eq(articles.id, articleId));
  revalidatePath("/catalogue");
  revalidatePath("/stocks");
}
