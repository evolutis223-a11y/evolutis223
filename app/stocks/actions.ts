"use server";

import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { articles, lots, lotVariantes, stockMouvements, variantes } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { repartirReserveAuProrata } from "@/lib/stock/allocation";

export interface StockActionState {
  error: string | null;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = typeof db | Tx;

async function requireStockAccess() {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Stocks")) {
    throw new Error("Accès refusé.");
  }
  return session;
}

// PMP (prix moyen pondéré) — moyenne pondérée entre le stock déjà valorisé et le nouveau lot.
async function nouveauPmp(
  tx: DbOrTx,
  articleId: number,
  quantiteEntree: number,
  prixAchatUnitaire: number
): Promise<string> {
  const [article] = await tx.select().from(articles).where(eq(articles.id, articleId)).limit(1);
  const result = await tx.execute(
    sql`select coalesce(sum(quantite), 0)::int as total from stock_mouvements where variante_id in
        (select id from variantes where article_id = ${articleId})`
  );
  const stockAvant = Number((result.rows[0] as { total: number } | undefined)?.total) || 0;
  const pmpAvant = Number(article.pmp);
  const valeurAvant = stockAvant > 0 ? pmpAvant * stockAvant : 0;
  const valeurNouvelle = quantiteEntree * prixAchatUnitaire;
  const totalApres = stockAvant + quantiteEntree;
  const pmp = totalApres > 0 ? (valeurAvant + valeurNouvelle) / totalApres : prixAchatUnitaire;
  return pmp.toFixed(2);
}

async function trouverOuCreerVariante(
  tx: DbOrTx,
  articleId: number,
  taille: string | null,
  couleur: string | null
) {
  const whereClauses =
    taille === null && couleur === null
      ? and(eq(variantes.articleId, articleId), isNull(variantes.taille), isNull(variantes.couleur))
      : and(eq(variantes.articleId, articleId), eq(variantes.taille, taille ?? ""), eq(variantes.couleur, couleur ?? ""));

  const existing = await tx.select().from(variantes).where(whereClauses!).limit(1);
  if (existing.length > 0) return existing[0];

  const [created] = await tx
    .insert(variantes)
    .values({ articleId, taille, couleur })
    .returning();
  return created;
}

export async function approvisionnerFamilleA(
  _prevState: StockActionState,
  formData: FormData
): Promise<StockActionState> {
  try {
    const session = await requireStockAccess();
    const articleId = Number(formData.get("articleId"));
    const douzaines = Number(formData.get("douzaines"));
    const couleur = String(formData.get("couleur") ?? "").trim();
    const prixAchatUnitaire = Number(formData.get("prixAchatUnitaire"));
    const reserveDetailPieces = Number(formData.get("reserveDetailPieces") ?? 0);
    const repartitionRaw = String(formData.get("repartitionJson") ?? "{}");

    if (!Number.isFinite(articleId)) return { error: "Article invalide." };
    if (!couleur) return { error: "Couleur requise." };
    if (!Number.isFinite(douzaines) || douzaines <= 0) return { error: "Nombre de douzaines invalide." };
    if (!Number.isFinite(prixAchatUnitaire) || prixAchatUnitaire < 0) {
      return { error: "Prix d'achat invalide." };
    }

    let repartitionParDouzaine: Record<string, number>;
    try {
      repartitionParDouzaine = JSON.parse(repartitionRaw);
    } catch {
      return { error: "Répartition invalide." };
    }
    const tailles = Object.keys(repartitionParDouzaine).filter((t) => repartitionParDouzaine[t] > 0);
    if (tailles.length === 0) return { error: "Renseignez au moins une taille." };

    const produitParTaille: Record<string, number> = {};
    for (const t of tailles) produitParTaille[t] = repartitionParDouzaine[t] * douzaines;
    const produitTotal = Object.values(produitParTaille).reduce((a, b) => a + b, 0);

    if (reserveDetailPieces < 0 || reserveDetailPieces > produitTotal) {
      return { error: `La réserve détail ne peut pas dépasser le total produit (${produitTotal} pièces).` };
    }

    const reserveParTaille = repartirReserveAuProrata(produitParTaille, reserveDetailPieces);
    const pmp = await nouveauPmp(db, articleId, produitTotal, prixAchatUnitaire);

    await db.transaction(async (tx) => {
      const [lot] = await tx
        .insert(lots)
        .values({ articleId, prixAchatUnitaire: prixAchatUnitaire.toFixed(2) })
        .returning();

      for (const taille of tailles) {
        const variante = await trouverOuCreerVariante(tx, articleId, taille, couleur);
        const totalTaille = produitParTaille[taille];
        const reserve = reserveParTaille[taille] ?? 0;

        await tx.insert(lotVariantes).values({
          lotId: lot.id,
          varianteId: variante.id,
          quantiteProduite: totalTaille,
        });

        await tx.insert(stockMouvements).values({
          varianteId: variante.id,
          lotId: lot.id,
          pool: "GROS",
          type: "ENTREE",
          quantite: totalTaille,
          auteurId: session.userId,
        });

        if (reserve > 0) {
          const transfertRef = randomUUID();
          await tx.insert(stockMouvements).values([
            {
              varianteId: variante.id,
              lotId: lot.id,
              pool: "GROS",
              type: "RESERVATION",
              quantite: -reserve,
              transfertRef,
              auteurId: session.userId,
            },
            {
              varianteId: variante.id,
              lotId: lot.id,
              pool: "DETAIL",
              type: "RESERVATION",
              quantite: reserve,
              transfertRef,
              auteurId: session.userId,
            },
          ]);
        }
      }

      await tx.update(articles).set({ pmp, aVariantes: true }).where(eq(articles.id, articleId));
    });

    revalidatePath("/stocks");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export async function approvisionnerFamilleB(
  _prevState: StockActionState,
  formData: FormData
): Promise<StockActionState> {
  try {
    const session = await requireStockAccess();
    const articleId = Number(formData.get("articleId"));
    const quantite = Number(formData.get("quantite"));
    const prixAchatUnitaire = Number(formData.get("prixAchatUnitaire"));
    const seuilAlerte = Number(formData.get("seuilAlerte") ?? 0);

    if (!Number.isFinite(articleId)) return { error: "Article invalide." };
    if (!Number.isFinite(quantite) || quantite <= 0) return { error: "Quantité invalide." };
    if (!Number.isFinite(prixAchatUnitaire) || prixAchatUnitaire < 0) {
      return { error: "Prix d'achat invalide." };
    }

    const pmp = await nouveauPmp(db, articleId, quantite, prixAchatUnitaire);

    await db.transaction(async (tx) => {
      const variante = await trouverOuCreerVariante(tx, articleId, null, null);
      if (Number.isFinite(seuilAlerte) && seuilAlerte >= 0) {
        await tx.update(variantes).set({ seuilAlerte }).where(eq(variantes.id, variante.id));
      }

      const [lot] = await tx
        .insert(lots)
        .values({ articleId, prixAchatUnitaire: prixAchatUnitaire.toFixed(2) })
        .returning();

      await tx.insert(lotVariantes).values({
        lotId: lot.id,
        varianteId: variante.id,
        quantiteProduite: quantite,
      });

      await tx.insert(stockMouvements).values({
        varianteId: variante.id,
        lotId: lot.id,
        pool: "DETAIL",
        type: "ENTREE",
        quantite,
        auteurId: session.userId,
      });

      await tx.update(articles).set({ pmp }).where(eq(articles.id, articleId));
    });

    revalidatePath("/stocks");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}
