"use server";

import { and, asc, eq, like, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  affaires,
  articles,
  demandesValidationStock,
  lignesAffaire,
  livraisons,
  lots,
  lotVariantes,
  ordresFabrication,
  reglements,
  stockMouvements,
  vStockVariante,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { enregistrerAudit } from "@/lib/audit";
import { calculerStockKit, decrementerKit } from "@/app/stocks/actions";

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
  // Famille D uniquement (§8.1) — décide si l'OF généré passe par Conception. true par défaut
  // (nouveau visuel/design), à décocher si c'est une réédition d'un modèle déjà validé.
  personnalise?: boolean;
  // §10bis — détail de configuration si la ligne vient du calculateur de marquage (zones,
  // techniques, main d'œuvre, charges, marge), conservé pour référence/audit.
  configMarquage?: unknown;
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
          personnalise: l.personnalise ?? true,
          configMarquage: l.configMarquage ?? null,
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

    // Demandes déjà en attente (ex. admin qui re-clique "Valider" avant résolution) — ne pas
    // en recréer, l'écran /validations affiche déjà celles-ci.
    const demandesEnAttente = await db
      .select({ id: demandesValidationStock.id })
      .from(demandesValidationStock)
      .where(
        and(eq(demandesValidationStock.affaireId, affaireId), eq(demandesValidationStock.statut, "EN_ATTENTE"))
      );
    if (demandesEnAttente.length > 0) {
      return { blocked: true };
    }

    const lignes = await db
      .select({
        id: lignesAffaire.id,
        articleId: lignesAffaire.articleId,
        varianteId: lignesAffaire.varianteId,
        quantite: lignesAffaire.quantite,
        famille: articles.famille,
        articleNom: articles.nom,
        personnalise: lignesAffaire.personnalise,
        necessiteAssemblage: articles.necessiteAssemblage,
      })
      .from(lignesAffaire)
      .innerJoin(articles, eq(articles.id, lignesAffaire.articleId))
      .where(eq(lignesAffaire.affaireId, affaireId));

    // Kits (Famille E, §8.3) : stock "goulot d'étranglement" sur stock gros, jamais la réserve
    // détail (point 4) — pas de workflow de validation Admin ici, juste un blocage direct si la
    // variante exacte requise manque (point 7).
    for (const l of lignes) {
      if (l.famille !== "E") continue;
      const { stockKitCalcule, composantLimitant } = await calculerStockKit(l.articleId);
      if (stockKitCalcule < l.quantite) {
        return {
          error: composantLimitant
            ? `Kit "${l.articleNom}" — stock insuffisant (disponible ${stockKitCalcule}, demandé ${l.quantite}) — composant limitant : variante ${composantLimitant.varianteId} (${composantLimitant.stockVariante} disponible ÷ ${composantLimitant.quantiteRequise} requis).`
            : `Kit "${l.articleNom}" — recette non définie, aucune vente possible.`,
        };
      }
    }

    // Contrôle de disponibilité en réserve détail (§9) avant tout décrément.
    const manques: { varianteId: number; quantiteDemandee: number; manque: number }[] = [];
    for (const l of lignes) {
      if (l.famille === "E" || !l.varianteId) continue;
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
          const [demande] = await tx
            .insert(demandesValidationStock)
            .values({
              affaireId,
              varianteId: m.varianteId,
              quantiteDemandee: m.quantiteDemandee,
              manque: m.manque,
              canal: "BOUTIQUE",
              demandeurId: session.userId,
            })
            .returning();
          await enregistrerAudit(tx, {
            tableCible: "demandes_validation_stock",
            enregistrementId: demande.id,
            action: "CREATION",
            utilisateurId: session.userId,
            details: { affaireId, varianteId: m.varianteId, manque: m.manque },
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
        if (l.famille === "E") {
          await decrementerKit(tx, l.articleId, l.quantite, affaireId, session.userId);
        } else if (l.varianteId) {
          await decrementerFifo(tx, l.varianteId, l.quantite, affaireId, session.userId);
        }

        // Ordre de Fabrication (§8.1 point 4) : toujours pour Famille D, seulement si la recette
        // du Kit est marquée « nécessite assemblage » pour Famille E. Jamais pour A/B/C.
        const declencheOf = l.famille === "D" || (l.famille === "E" && l.necessiteAssemblage);
        if (declencheOf) {
          const [of_] = await tx
            .insert(ordresFabrication)
            .values({
              affaireId,
              ligneAffaireId: l.id,
              personnalise: l.famille === "D" ? l.personnalise : false,
            })
            .returning();
          await enregistrerAudit(tx, {
            tableCible: "ordres_fabrication",
            enregistrementId: of_.id,
            action: "CREATION",
            utilisateurId: session.userId,
            details: { affaireId, ligneAffaireId: l.id, articleNom: l.articleNom },
          });
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
