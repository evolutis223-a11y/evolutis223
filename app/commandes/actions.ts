"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { affaires, livraisons } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";

const ORDRE_STATUTS = ["EN_ATTENTE", "PRIS_EN_CHARGE", "EN_ROUTE", "LIVREE"] as const;

export async function avancerLivraison(
  livraisonId: number,
  nextStatut: (typeof ORDRE_STATUTS)[number] | "ECHEC"
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Commandes")) {
    return { error: "Accès refusé." };
  }

  const [livraison] = await db.select().from(livraisons).where(eq(livraisons.id, livraisonId)).limit(1);
  if (!livraison) return { error: "Livraison introuvable." };

  if (nextStatut !== "ECHEC") {
    const idxActuel = ORDRE_STATUTS.indexOf(livraison.statut as (typeof ORDRE_STATUTS)[number]);
    const idxSuivant = ORDRE_STATUTS.indexOf(nextStatut);
    if (idxSuivant !== idxActuel + 1) {
      return { error: "Transition de statut invalide (ordre non respecté)." };
    }
  }

  await db.transaction(async (tx) => {
    await tx.update(livraisons).set({ statut: nextStatut }).where(eq(livraisons.id, livraisonId));
    if (nextStatut === "LIVREE") {
      await tx.update(affaires).set({ statut: "CLOTUREE" }).where(eq(affaires.id, livraison.affaireId));
    }
  });

  revalidatePath("/commandes");
  revalidatePath("/affaires");
  return {};
}
