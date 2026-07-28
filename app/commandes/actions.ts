"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { affaires, fondsCirculation, livraisons, roles, utilisateurs } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";

const ORDRE_STATUTS = ["EN_ATTENTE", "PRIS_EN_CHARGE", "EN_ROUTE", "LIVREE"] as const;

export async function listerLivreurs() {
  return db
    .select({ id: utilisateurs.id, nom: utilisateurs.nom, roleCode: roles.code })
    .from(utilisateurs)
    .innerJoin(roles, eq(roles.id, utilisateurs.roleId))
    .where(inArray(roles.code, ["LIVREUR", "LIVREUR_PARTENAIRE"]));
}

export async function assignerLivreur(livraisonId: number, livreurId: number): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Commandes")) {
    return { error: "Accès refusé." };
  }
  if (!Number.isFinite(livreurId)) return { error: "Livreur invalide." };

  await db.update(livraisons).set({ livreurId }).where(eq(livraisons.id, livraisonId));
  revalidatePath("/commandes");
  return {};
}

// Cash-on-delivery (§8.2 points 5-7) : un encaissement espèces collecté sur le terrain par le
// livreur ne rejoint jamais directement la Trésorerie — il passe par fonds_circulation, sous la
// responsabilité du livreur, jusqu'à remise et validation Admin/Comptable (/fonds-circulation).
export async function avancerLivraison(
  livraisonId: number,
  nextStatut: (typeof ORDRE_STATUTS)[number] | "ECHEC",
  montantEspecesCollecte?: number
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

  const encaissement = nextStatut === "LIVREE" && montantEspecesCollecte && montantEspecesCollecte > 0;
  if (encaissement && !livraison.livreurId) {
    return { error: "Assignez un livreur avant d'enregistrer un encaissement terrain." };
  }

  await db.transaction(async (tx) => {
    await tx.update(livraisons).set({ statut: nextStatut }).where(eq(livraisons.id, livraisonId));
    if (nextStatut === "LIVREE") {
      await tx.update(affaires).set({ statut: "CLOTUREE" }).where(eq(affaires.id, livraison.affaireId));
      if (encaissement) {
        await tx.insert(fondsCirculation).values({
          livreurId: livraison.livreurId!,
          affaireId: livraison.affaireId,
          montantAttendu: montantEspecesCollecte!.toFixed(2),
        });
      }
    }
  });

  revalidatePath("/commandes");
  revalidatePath("/affaires");
  revalidatePath("/fonds-circulation");
  return {};
}
