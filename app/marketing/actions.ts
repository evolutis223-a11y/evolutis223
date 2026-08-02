"use server";

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { articles, parametresMarketing, promotions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";

async function requireMarketingAccess() {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Marketing")) {
    throw new Error("Accès refusé.");
  }
  return session;
}

export async function chargerDonneesMarketing() {
  await requireMarketingAccess();

  const [promoRows, articleRows, paramRows] = await Promise.all([
    db
      .select({
        id: promotions.id,
        nom: promotions.nom,
        articleId: promotions.articleId,
        articleNom: articles.nom,
        prixVente: articles.prixVente,
        type: promotions.type,
        valeur: promotions.valeur,
        dateDebut: promotions.dateDebut,
        dateFin: promotions.dateFin,
        actif: promotions.actif,
      })
      .from(promotions)
      .innerJoin(articles, eq(articles.id, promotions.articleId))
      .orderBy(desc(promotions.dateCreation))
      .limit(100),
    db
      .select({ id: articles.id, nom: articles.nom, code: articles.code, prixVente: articles.prixVente })
      .from(articles)
      .where(eq(articles.publieBoutique, true))
      .orderBy(articles.nom),
    db.select().from(parametresMarketing).limit(1),
  ]);

  const param = paramRows[0];

  return {
    promotions: promoRows.map((p) => ({ ...p, prixVente: Number(p.prixVente), valeur: Number(p.valeur) })),
    articles: articleRows.map((a) => ({ ...a, prixVente: Number(a.prixVente) })),
    messageBanniere: param?.messageBanniere ?? "",
    banniereActive: param?.banniereActive ?? false,
  };
}

export interface PromotionState {
  error: string | null;
  promotionId?: number;
}

export async function ajouterPromotion(_prev: PromotionState, formData: FormData): Promise<PromotionState> {
  try {
    const session = await requireMarketingAccess();
    const nom = String(formData.get("nom") ?? "").trim();
    const articleId = Number(formData.get("articleId"));
    const type = String(formData.get("type") ?? "");
    const valeur = Number(formData.get("valeur"));
    const dateDebut = String(formData.get("dateDebut") ?? "").trim();
    const dateFin = String(formData.get("dateFin") ?? "").trim();

    if (!nom) return { error: "Nom requis." };
    if (!articleId) return { error: "Article requis." };
    if (!["POURCENTAGE", "MONTANT_FIXE"].includes(type)) return { error: "Type invalide." };
    if (!Number.isFinite(valeur) || valeur <= 0) return { error: "Valeur invalide." };
    if (type === "POURCENTAGE" && valeur > 100) return { error: "Un pourcentage ne peut pas dépasser 100." };
    if (!dateDebut || !dateFin) return { error: "Dates requises." };
    if (dateFin < dateDebut) return { error: "La date de fin doit être après la date de début." };

    const [created] = await db
      .insert(promotions)
      .values({ nom, articleId, type, valeur: valeur.toFixed(2), dateDebut, dateFin, auteurId: session.userId })
      .returning();
    revalidatePath("/marketing");
    revalidatePath("/boutique");
    return { error: null, promotionId: created.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur." };
  }
}

export async function retirerPromotion(id: number) {
  await requireMarketingAccess();
  await db.update(promotions).set({ actif: false }).where(eq(promotions.id, id));
  revalidatePath("/marketing");
  revalidatePath("/boutique");
}

export async function definirBanniere(message: string, active: boolean) {
  const session = await requireMarketingAccess();
  const [existing] = await db.select().from(parametresMarketing).limit(1);
  if (existing) {
    await db
      .update(parametresMarketing)
      .set({ messageBanniere: message || null, banniereActive: active, modifiePar: session.userId, dateModification: new Date() })
      .where(eq(parametresMarketing.id, existing.id));
  } else {
    await db.insert(parametresMarketing).values({ messageBanniere: message || null, banniereActive: active, modifiePar: session.userId });
  }
  revalidatePath("/marketing");
  revalidatePath("/boutique");
}

export interface PromotionActive {
  articleId: number;
  type: string;
  valeur: number;
}

// Utilisé par /boutique (route publique) — pas de contrôle d'accès ici, lecture seule de
// promotions déjà actives/dans leur fenêtre de dates, rien de sensible.
export async function chargerPromotionsActives(): Promise<PromotionActive[]> {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({ articleId: promotions.articleId, type: promotions.type, valeur: promotions.valeur })
    .from(promotions)
    .where(and(eq(promotions.actif, true), lte(promotions.dateDebut, aujourdhui), gte(promotions.dateFin, aujourdhui)));
  return rows.map((r) => ({ ...r, valeur: Number(r.valeur) }));
}

export async function chargerBanniereBoutique(): Promise<{ message: string | null; active: boolean }> {
  const [param] = await db.select().from(parametresMarketing).limit(1);
  return { message: param?.messageBanniere ?? null, active: param?.banniereActive ?? false };
}
