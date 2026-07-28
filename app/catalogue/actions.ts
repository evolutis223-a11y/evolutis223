"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";

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
    aVariantes: famille === "A",
    publieBoutique,
    photoUrl: photoUrl || null,
    brancheId,
  });

  revalidatePath("/catalogue");
  return { error: null };
}

export async function togglePublieBoutique(articleId: number, next: boolean) {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Catalogue")) {
    throw new Error("Accès refusé.");
  }
  await db.update(articles).set({ publieBoutique: next }).where(eq(articles.id, articleId));
  revalidatePath("/catalogue");
}
