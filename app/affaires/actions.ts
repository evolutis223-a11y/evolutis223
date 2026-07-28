"use server";

import { and, asc, eq, like, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  affaires,
  demandesValidationStock,
  lignesAffaire,
  livraisons,
  lots,
  lotVariantes,
  reglements,
  stockMouvements,
  vStockVariante,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";

async function requireAffairesAccess() {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Affaires")) {
    throw new Error("Accès refusé.");
  }
  return session;
}

async function genererNumero(prefix: string): Promise<string> {
  const annee = new Date().getFullYear().toString().slice(-2);
  const like_ = `${prefix}-${annee}-%`;
  const rows = await db
    .select({ numero: affaires.numero })
    .from(affaires)
    .where(like(affaires.numero, like_));
  const seq = rows.length + 1;
  return `${prefix}-${annee}-${seq.toString().padStart(4, "0")}`;
}

async function genererNumeroLivraison(): Promise<string> {
  const annee = new Date().getFullYear().toString().slice(-2);
  const rows = await db
    .select({ numero: livraisons.numero })
    .from(livraisons)
    .where(like(livraisons.numero, `LIV-${annee}-%`));
  const seq = rows.length + 1;
  return `LIV-${annee}-${seq.toString().padStart(4, "0")}`;
}

export interface LigneInput {
  articleId: number;
  varianteId: number | null;
  quantite: number;
  prixUnitaire: number;
}

export async function creerAffaire(
  clientId: number,
  lignes: LigneInput[],
  modeFinalisation: "RETRAIT" | "LIVRAISON" | null = null,
  adresseLivraison: string | null = null
): Promise<{ affaireId?: number; error?: string }> {
  try {
    const session = await requireAffairesAccess();
    if (!clientId) return { error: "Client requis." };
    if (lignes.length === 0) return { error: "Au moins une ligne requise." };
    if (modeFinalisation === "LIVRAISON" && !adresseLivraison) {
      return { error: "Adresse de livraison requise." };
    }

    const montantTtc = lignes.reduce((acc, l) => acc + l.quantite * l.prixUnitaire, 0);
    const numero = await genererNumero("CDE");

    const affaireId = await db.transaction(async (tx) => {
      const [affaire] = await tx
        .insert(affaires)
        .values({
          numero,
          type: "COMMANDE_ATTENTE",
          statut: "EN_ATTENTE",
          modeFinalisation,
          clientId,
          montantTtc: montantTtc.toFixed(2),
          auteurId: session.userId,
        })
        .returning();

      for (const l of lignes) {
        await tx.insert(lignesAffaire).values({
          affaireId: affaire.id,
          articleId: l.articleId,
          varianteId: l.varianteId,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire.toFixed(2),
        });
      }

      if (modeFinalisation === "LIVRAISON") {
        const numeroLivraison = await genererNumeroLivraison();
        await tx.insert(livraisons).values({
          numero: numeroLivraison,
          affaireId: affaire.id,
          adresse: adresseLivraison,
        });
      }

      return affaire.id;
    });

    revalidatePath("/affaires");
    return { affaireId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

// Décrémente une ligne en FIFO par lot (le plus ancien en premier, §5) sur le pool DETAIL.
async function decrementerFifo(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  varianteId: number,
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
      and(eq(stockMouvements.lotId, lotVariantes.lotId), eq(stockMouvements.varianteId, varianteId), eq(stockMouvements.pool, "DETAIL"))
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
      pool: "DETAIL",
      type: "VENTE",
      quantite: -pris,
      affaireId,
      auteurId,
    });
    restant -= pris;
  }
  if (restant > 0) {
    // Filet de sécurité : ne devrait jamais arriver, le contrôle de disponibilité a lieu avant.
    await tx.insert(stockMouvements).values({
      varianteId,
      pool: "DETAIL",
      type: "VENTE",
      quantite: -restant,
      affaireId,
      auteurId,
    });
  }
}

export async function validerAffaire(
  affaireId: number
): Promise<{ error?: string; blocked?: boolean }> {
  try {
    const session = await requireAffairesAccess();

    const [affaire] = await db.select().from(affaires).where(eq(affaires.id, affaireId)).limit(1);
    if (!affaire) return { error: "Affaire introuvable." };
    if (affaire.immuable) return { error: "Cette affaire est déjà validée." };

    const lignes = await db.select().from(lignesAffaire).where(eq(lignesAffaire.affaireId, affaireId));

    // Contrôle de disponibilité en réserve détail (§9) avant tout décrément.
    const manques: { varianteId: number; quantiteDemandee: number; manque: number }[] = [];
    for (const l of lignes) {
      if (!l.varianteId) continue;
      const [stock] = await db
        .select({ stockDetail: vStockVariante.stockDetail })
        .from(vStockVariante)
        .where(eq(vStockVariante.varianteId, l.varianteId))
        .limit(1);
      const dispo = stock?.stockDetail ?? 0;
      if (dispo < l.quantite) {
        manques.push({ varianteId: l.varianteId, quantiteDemandee: l.quantite, manque: l.quantite - dispo });
      }
    }

    if (manques.length > 0) {
      await db.transaction(async (tx) => {
        for (const m of manques) {
          await tx.insert(demandesValidationStock).values({
            affaireId,
            varianteId: m.varianteId,
            quantiteDemandee: m.quantiteDemandee,
            manque: m.manque,
            canal: "BOUTIQUE",
            demandeurId: session.userId,
          });
        }
      });
      revalidatePath("/affaires");
      return { blocked: true };
    }

    const numero = await genererNumero("TIC");
    // Retrait/Livraison : le stock est déjà commité et le document déjà émis à la validation
    // (§8.4 point 6 — le PDF/cachet ne dépend pas du retrait physique), mais l'affaire reste
    // VALIDEE tant que le colis n'a pas réellement été remis (§8.1) ; sans mode de finalisation
    // (vente comptoir directe), il n'y a rien à attendre de plus : CLOTUREE immédiatement.
    const statutFinal = affaire.modeFinalisation ? "VALIDEE" : "CLOTUREE";

    await db.transaction(async (tx) => {
      for (const l of lignes) {
        if (l.varianteId) {
          await decrementerFifo(tx, l.varianteId, l.quantite, affaireId, session.userId);
        }
      }
      await tx
        .update(affaires)
        .set({ type: "TICKET", statut: statutFinal, immuable: true, numero })
        .where(eq(affaires.id, affaireId));
    });

    revalidatePath("/affaires");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export interface ReglementState {
  error: string | null;
}

export async function ajouterReglement(
  _prevState: ReglementState,
  formData: FormData
): Promise<ReglementState> {
  const session = await requireAffairesAccess();
  const affaireId = Number(formData.get("affaireId"));
  const montant = Number(formData.get("montant"));
  const mode = String(formData.get("mode") ?? "");

  if (!Number.isFinite(affaireId)) return { error: "Affaire invalide." };
  if (!Number.isFinite(montant) || montant <= 0) return { error: "Montant invalide." };
  if (!["ESPECES", "MOBILE_MONEY", "VIREMENT", "CARTE"].includes(mode)) {
    return { error: "Mode de règlement invalide." };
  }

  await db.insert(reglements).values({
    affaireId,
    montant: montant.toFixed(2),
    mode,
    auteurId: session.userId,
  });

  revalidatePath("/affaires");
  return { error: null };
}

export async function marquerRetiree(affaireId: number): Promise<{ error?: string }> {
  await requireAffairesAccess();
  const [affaire] = await db.select().from(affaires).where(eq(affaires.id, affaireId)).limit(1);
  if (!affaire) return { error: "Affaire introuvable." };
  if (affaire.modeFinalisation !== "RETRAIT") return { error: "Cette affaire n'est pas en retrait." };
  if (affaire.statut !== "VALIDEE") return { error: "Affaire pas encore validée." };

  await db.update(affaires).set({ statut: "CLOTUREE" }).where(eq(affaires.id, affaireId));
  revalidatePath("/affaires");
  revalidatePath("/commandes");
  return {};
}
