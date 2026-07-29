"use server";

import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { articles, fournisseurs, kitComposants, lots, lotVariantes, stockMouvements, variantes, vStockVariante } from "@/db/schema";
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

// Lecture seule, accessible depuis le formulaire d'approvisionnement (accès Stocks suffit —
// pas besoin du module Fournisseurs pour juste choisir dans la liste au moment de la saisie).
export async function listerFournisseursActifs() {
  await requireStockAccess();
  return db
    .select({ id: fournisseurs.id, nom: fournisseurs.nom })
    .from(fournisseurs)
    .where(eq(fournisseurs.actif, true))
    .orderBy(asc(fournisseurs.nom));
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
    const fournisseurIdRaw = String(formData.get("fournisseurId") ?? "").trim();
    const fournisseurId = fournisseurIdRaw ? Number(fournisseurIdRaw) : null;

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
        .values({ articleId, prixAchatUnitaire: prixAchatUnitaire.toFixed(2), fournisseurId })
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

// §8.3 — Kits (Famille E) : recette + calcul de stock "goulot d'étranglement".

export async function listerRecetteKit(kitArticleId: number) {
  return db
    .select({
      id: kitComposants.id,
      composantArticleId: kitComposants.composantArticleId,
      composantNom: articles.nom,
      varianteId: kitComposants.varianteId,
      taille: variantes.taille,
      couleur: variantes.couleur,
      quantiteRequise: kitComposants.quantiteRequise,
    })
    .from(kitComposants)
    .innerJoin(articles, eq(articles.id, kitComposants.composantArticleId))
    .leftJoin(variantes, eq(variantes.id, kitComposants.varianteId))
    .where(eq(kitComposants.kitArticleId, kitArticleId));
}

export interface ComposantLimitant {
  composantArticleId: number;
  varianteId: number;
  quantiteRequise: number;
  stockVariante: number;
  stockPossible: number;
}

// Algorithme validé (§8.3) : stock du kit = plus petit stock possible parmi les composants,
// chacun contrôlé sur sa variante exacte. Famille A (détail/gros) : réserve détail exclue,
// point 4 — donc stock gros. Famille B (pas de split détail/gros) : son seul pool réel
// (stockDetail, jamais alimenté en gros par approvisionnerFamilleB). Jamais agrégé sur une
// famille de tailles.
export async function calculerStockKit(
  kitArticleId: number,
  tx: DbOrTx = db
): Promise<{ stockKitCalcule: number; composantLimitant: ComposantLimitant | null }> {
  const recette = await tx
    .select({
      composantArticleId: kitComposants.composantArticleId,
      composantFamille: articles.famille,
      varianteId: kitComposants.varianteId,
      quantiteRequise: kitComposants.quantiteRequise,
    })
    .from(kitComposants)
    .innerJoin(articles, eq(articles.id, kitComposants.composantArticleId))
    .where(eq(kitComposants.kitArticleId, kitArticleId));

  if (recette.length === 0) {
    return { stockKitCalcule: 0, composantLimitant: null };
  }

  let stockKit = Infinity;
  let composantLimitant: ComposantLimitant | null = null;

  for (const ligne of recette) {
    if (ligne.varianteId == null) {
      throw new Error(
        `Composant ${ligne.composantArticleId} du kit sans variante exacte définie (§8.3) — recette invalide.`
      );
    }
    const [stock] = await tx
      .select({ stockGros: vStockVariante.stockGros, stockDetail: vStockVariante.stockDetail })
      .from(vStockVariante)
      .where(eq(vStockVariante.varianteId, ligne.varianteId))
      .limit(1);
    const stockVariante = ligne.composantFamille === "A" ? stock?.stockGros ?? 0 : stock?.stockDetail ?? 0;
    const stockPossible = Math.floor(stockVariante / ligne.quantiteRequise);
    if (stockPossible < stockKit) {
      stockKit = stockPossible;
      composantLimitant = { ...ligne, varianteId: ligne.varianteId, stockVariante, stockPossible };
    }
  }

  return { stockKitCalcule: stockKit, composantLimitant };
}

// FIFO par lot (comme decrementerFifo, app/affaires/actions.ts) mais paramétré par pool — les
// composants d'un Kit se décrémentent sur GROS (Famille A) ou DETAIL (Famille B, son seul pool).
async function decrementerFifoParPool(
  tx: DbOrTx,
  varianteId: number,
  pool: "GROS" | "DETAIL",
  quantite: number,
  affaireId: number,
  auteurId: number
) {
  const lotsDisponibles = await tx
    .select({
      lotId: lotVariantes.lotId,
      dateReception: lots.dateReception,
      disponible: sql<number>`coalesce(sum(${stockMouvements.quantite}), 0)`,
    })
    .from(lotVariantes)
    .innerJoin(lots, eq(lots.id, lotVariantes.lotId))
    .leftJoin(
      stockMouvements,
      and(eq(stockMouvements.lotId, lotVariantes.lotId), eq(stockMouvements.varianteId, varianteId), eq(stockMouvements.pool, pool))
    )
    .where(eq(lotVariantes.varianteId, varianteId))
    .groupBy(lotVariantes.lotId, lots.dateReception)
    .orderBy(asc(lots.dateReception));

  let restant = quantite;
  for (const lot of lotsDisponibles) {
    if (restant <= 0) break;
    const dispo = Number(lot.disponible);
    if (dispo <= 0) continue;
    const pris = Math.min(dispo, restant);
    await tx.insert(stockMouvements).values({
      varianteId,
      lotId: lot.lotId,
      pool,
      type: "VENTE",
      quantite: -pris,
      affaireId,
      auteurId,
    });
    restant -= pris;
  }
  if (restant > 0) {
    // Filet de sécurité : ne devrait jamais arriver, la disponibilité est vérifiée avant (calculerStockKit).
    await tx.insert(stockMouvements).values({
      varianteId,
      pool,
      type: "VENTE",
      quantite: -restant,
      affaireId,
      auteurId,
    });
  }
}

// Vente d'un Kit : décrémente chaque composant sur sa variante exacte (§8.3 point 8).
export async function decrementerKit(
  tx: DbOrTx,
  kitArticleId: number,
  quantiteVendue: number,
  affaireId: number,
  auteurId: number
) {
  const recette = await tx
    .select({
      varianteId: kitComposants.varianteId,
      quantiteRequise: kitComposants.quantiteRequise,
      composantFamille: articles.famille,
    })
    .from(kitComposants)
    .innerJoin(articles, eq(articles.id, kitComposants.composantArticleId))
    .where(eq(kitComposants.kitArticleId, kitArticleId));

  for (const ligne of recette) {
    if (ligne.varianteId == null) continue;
    const pool = ligne.composantFamille === "A" ? "GROS" : "DETAIL";
    await decrementerFifoParPool(
      tx,
      ligne.varianteId,
      pool,
      ligne.quantiteRequise * quantiteVendue,
      affaireId,
      auteurId
    );
  }
}

export interface ComposantKitState {
  error: string | null;
}

export async function ajouterComposantKit(
  _prevState: ComposantKitState,
  formData: FormData
): Promise<ComposantKitState> {
  try {
    await requireStockAccess();
    const kitArticleId = Number(formData.get("kitArticleId"));
    const composantArticleId = Number(formData.get("composantArticleId"));
    const varianteId = Number(formData.get("varianteId"));
    const quantiteRequise = Number(formData.get("quantiteRequise"));

    if (!Number.isFinite(kitArticleId)) return { error: "Kit invalide." };
    if (!Number.isFinite(composantArticleId)) return { error: "Composant invalide." };
    if (kitArticleId === composantArticleId) return { error: "Un kit ne peut pas se contenir lui-même." };
    if (!Number.isFinite(varianteId)) {
      return { error: "Variante exacte requise (§8.3) — jamais une famille entière de tailles." };
    }
    if (!Number.isFinite(quantiteRequise) || quantiteRequise <= 0) {
      return { error: "Quantité requise invalide." };
    }

    await db.insert(kitComposants).values({ kitArticleId, composantArticleId, varianteId, quantiteRequise });

    revalidatePath("/stocks");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export async function retirerComposantKit(composantId: number): Promise<{ error?: string }> {
  try {
    await requireStockAccess();
    await db.delete(kitComposants).where(eq(kitComposants.id, composantId));
    revalidatePath("/stocks");
    return {};
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
    const fournisseurIdRaw = String(formData.get("fournisseurId") ?? "").trim();
    const fournisseurId = fournisseurIdRaw ? Number(fournisseurIdRaw) : null;

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
        .values({ articleId, prixAchatUnitaire: prixAchatUnitaire.toFixed(2), fournisseurId })
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
