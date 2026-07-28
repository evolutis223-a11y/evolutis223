"use server";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  affaires,
  articles,
  demandesValidationStock,
  lotVariantes,
  lots,
  stockMouvements,
  variantes,
  vStockVariante,
} from "@/db/schema";
import { getSession, type SessionPayload } from "@/lib/auth";
import { enregistrerAudit } from "@/lib/audit";
import { validerAffaire } from "@/app/affaires/actions";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.roleCode)) {
    throw new Error("Accès réservé à Admin/Super Admin.");
  }
  return session;
}

// Transfert réserve détail (§9) : 2 lignes liées par transfertRef, même mécanique que
// l'approvisionnement (app/stocks/actions.ts) — FIFO par lot (comme decrementerFifo, §5)
// pour garder la traçabilité par lot au lieu d'un lot_id nul.
async function transfererGrosVersDetail(
  tx: Tx,
  varianteId: number,
  quantite: number,
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
      and(eq(stockMouvements.lotId, lotVariantes.lotId), eq(stockMouvements.varianteId, varianteId), eq(stockMouvements.pool, "GROS"))
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
    const transfertRef = randomUUID();
    await tx.insert(stockMouvements).values([
      { varianteId, lotId: lot.lotId, pool: "GROS", type: "RESERVATION", quantite: -pris, transfertRef, auteurId },
      { varianteId, lotId: lot.lotId, pool: "DETAIL", type: "RESERVATION", quantite: pris, transfertRef, auteurId },
    ]);
    restant -= pris;
  }
  if (restant > 0) {
    // Filet de sécurité : ne devrait jamais arriver, la disponibilité gros est vérifiée avant appel.
    const transfertRef = randomUUID();
    await tx.insert(stockMouvements).values([
      { varianteId, pool: "GROS", type: "RESERVATION", quantite: -restant, transfertRef, auteurId },
      { varianteId, pool: "DETAIL", type: "RESERVATION", quantite: restant, transfertRef, auteurId },
    ]);
  }
}

async function finaliserSiPossible(affaireId: number) {
  const restantes = await db
    .select({ id: demandesValidationStock.id })
    .from(demandesValidationStock)
    .where(
      and(eq(demandesValidationStock.affaireId, affaireId), eq(demandesValidationStock.statut, "EN_ATTENTE"))
    );
  if (restantes.length > 0) return;
  await validerAffaire(affaireId);
}

async function chargerDemande(demandeId: number) {
  const [demande] = await db
    .select()
    .from(demandesValidationStock)
    .where(eq(demandesValidationStock.id, demandeId))
    .limit(1);
  return demande;
}

export async function autoriserDemande(demandeId: number): Promise<{ error?: string }> {
  try {
    const session = await requireAdmin();
    const demande = await chargerDemande(demandeId);
    if (!demande) return { error: "Demande introuvable." };
    if (demande.statut !== "EN_ATTENTE") return { error: "Demande déjà traitée." };

    const [stock] = await db
      .select({ stockGros: vStockVariante.stockGros })
      .from(vStockVariante)
      .where(eq(vStockVariante.varianteId, demande.varianteId))
      .limit(1);
    const dispoGros = stock?.stockGros ?? 0;
    if (dispoGros < demande.manque) {
      return { error: `Stock gros insuffisant (${dispoGros} disponible, ${demande.manque} requis).` };
    }

    await db.transaction(async (tx) => {
      await transfererGrosVersDetail(tx, demande.varianteId, demande.manque, session.userId);
      await tx
        .update(demandesValidationStock)
        .set({ statut: "AUTORISEE", traiteParId: session.userId, dateTraitement: new Date() })
        .where(eq(demandesValidationStock.id, demandeId));
      await enregistrerAudit(tx, {
        tableCible: "demandes_validation_stock",
        enregistrementId: demandeId,
        action: "VALIDATION",
        utilisateurId: session.userId,
        details: { decision: "AUTORISEE", quantiteTransferee: demande.manque },
      });
    });

    await finaliserSiPossible(demande.affaireId);
    revalidatePath("/validations");
    revalidatePath("/affaires");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export async function rechargerDemande(
  demandeId: number,
  quantite: number
): Promise<{ error?: string }> {
  try {
    const session = await requireAdmin();
    const demande = await chargerDemande(demandeId);
    if (!demande) return { error: "Demande introuvable." };
    if (demande.statut !== "EN_ATTENTE") return { error: "Demande déjà traitée." };
    if (!Number.isFinite(quantite) || quantite < demande.manque) {
      return { error: `La quantité doit être au moins égale au manque (${demande.manque}).` };
    }

    const [stock] = await db
      .select({ stockGros: vStockVariante.stockGros })
      .from(vStockVariante)
      .where(eq(vStockVariante.varianteId, demande.varianteId))
      .limit(1);
    const dispoGros = stock?.stockGros ?? 0;
    if (dispoGros < quantite) {
      return { error: `Stock gros insuffisant (${dispoGros} disponible, ${quantite} demandés).` };
    }

    await db.transaction(async (tx) => {
      await transfererGrosVersDetail(tx, demande.varianteId, quantite, session.userId);
      await tx
        .update(demandesValidationStock)
        .set({
          statut: "RECHARGEE",
          quantiteRechargee: quantite,
          traiteParId: session.userId,
          dateTraitement: new Date(),
        })
        .where(eq(demandesValidationStock.id, demandeId));
      await enregistrerAudit(tx, {
        tableCible: "demandes_validation_stock",
        enregistrementId: demandeId,
        action: "VALIDATION",
        utilisateurId: session.userId,
        details: { decision: "RECHARGEE", quantiteTransferee: quantite },
      });
    });

    await finaliserSiPossible(demande.affaireId);
    revalidatePath("/validations");
    revalidatePath("/affaires");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export async function listerDemandesEnAttente() {
  await requireAdmin();
  return db
    .select({
      id: demandesValidationStock.id,
      affaireId: demandesValidationStock.affaireId,
      affaireNumero: affaires.numero,
      varianteId: demandesValidationStock.varianteId,
      articleNom: articles.nom,
      taille: variantes.taille,
      couleur: variantes.couleur,
      quantiteDemandee: demandesValidationStock.quantiteDemandee,
      manque: demandesValidationStock.manque,
      canal: demandesValidationStock.canal,
      statut: demandesValidationStock.statut,
      quantiteRechargee: demandesValidationStock.quantiteRechargee,
      dateCreation: demandesValidationStock.dateCreation,
      dateTraitement: demandesValidationStock.dateTraitement,
    })
    .from(demandesValidationStock)
    .innerJoin(affaires, eq(affaires.id, demandesValidationStock.affaireId))
    .innerJoin(variantes, eq(variantes.id, demandesValidationStock.varianteId))
    .innerJoin(articles, eq(articles.id, variantes.articleId))
    .where(eq(demandesValidationStock.statut, "EN_ATTENTE"))
    .orderBy(desc(demandesValidationStock.dateCreation));
}

// §12 : validation Admin/Super Admin d'une proforma avant qu'elle ne puisse être envoyée au
// client — même logique de file d'attente que §9, mais sur affaires.statut directement.
export async function validerProforma(affaireId: number): Promise<{ error?: string }> {
  try {
    const session = await requireAdmin();
    const [affaire] = await db
      .select()
      .from(affaires)
      .where(and(eq(affaires.id, affaireId), eq(affaires.type, "PROFORMA")))
      .limit(1);
    if (!affaire) return { error: "Proforma introuvable." };
    if (affaire.statut !== "EN_ATTENTE") return { error: "Cette proforma est déjà traitée." };

    await db.transaction(async (tx) => {
      await tx.update(affaires).set({ statut: "VALIDEE" }).where(eq(affaires.id, affaireId));
      await enregistrerAudit(tx, {
        tableCible: "affaires",
        enregistrementId: affaireId,
        action: "VALIDATION",
        utilisateurId: session.userId,
        details: { type: "PROFORMA", decision: "VALIDEE" },
      });
    });

    revalidatePath("/validations");
    revalidatePath("/commercial");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export async function refuserProforma(affaireId: number): Promise<{ error?: string }> {
  try {
    const session = await requireAdmin();
    const [affaire] = await db
      .select()
      .from(affaires)
      .where(and(eq(affaires.id, affaireId), eq(affaires.type, "PROFORMA")))
      .limit(1);
    if (!affaire) return { error: "Proforma introuvable." };
    if (affaire.statut !== "EN_ATTENTE") return { error: "Cette proforma est déjà traitée." };

    await db.transaction(async (tx) => {
      await tx.update(affaires).set({ statut: "ANNULEE" }).where(eq(affaires.id, affaireId));
      await enregistrerAudit(tx, {
        tableCible: "affaires",
        enregistrementId: affaireId,
        action: "VALIDATION",
        utilisateurId: session.userId,
        details: { type: "PROFORMA", decision: "REFUSEE" },
      });
    });

    revalidatePath("/validations");
    revalidatePath("/commercial");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export async function refuserDemande(demandeId: number): Promise<{ error?: string }> {
  try {
    const session = await requireAdmin();
    const demande = await chargerDemande(demandeId);
    if (!demande) return { error: "Demande introuvable." };
    if (demande.statut !== "EN_ATTENTE") return { error: "Demande déjà traitée." };

    await db.transaction(async (tx) => {
      await tx
        .update(demandesValidationStock)
        .set({ statut: "REFUSEE", traiteParId: session.userId, dateTraitement: new Date() })
        .where(eq(demandesValidationStock.id, demandeId));
      await enregistrerAudit(tx, {
        tableCible: "demandes_validation_stock",
        enregistrementId: demandeId,
        action: "VALIDATION",
        utilisateurId: session.userId,
        details: { decision: "REFUSEE" },
      });
    });

    revalidatePath("/validations");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}
