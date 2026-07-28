"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { ordresFabrication, roles, utilisateurs } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { enregistrerAudit } from "@/lib/audit";

async function requireProductionAccess() {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Production")) {
    throw new Error("Accès refusé.");
  }
  return session;
}

// §8.1 : Réception (entrée universelle) → Conception (si personnalisé) → Production →
// Contrôle qualité → Prêt. Un OF non personnalisé (ex. Kit assemblé) ne passe jamais par
// Conception — CORRECTION 2026-07-28, "Conception" n'avait pas de sens pour tout OF.
function sequencePour(personnalise: boolean): string[] {
  return personnalise
    ? ["RECEPTION", "CONCEPTION", "PRODUCTION", "CONTROLE_QUALITE", "PRET"]
    : ["RECEPTION", "PRODUCTION", "CONTROLE_QUALITE", "PRET"];
}

export async function listerPilotes() {
  return db
    .select({ id: utilisateurs.id, nom: utilisateurs.nom, roleCode: roles.code })
    .from(utilisateurs)
    .innerJoin(roles, eq(roles.id, utilisateurs.roleId))
    .where(inArray(roles.code, ["EMPLOYE", "MANAGER"]));
}

export async function avancerOf(ofId: number, nextEtape: string): Promise<{ error?: string }> {
  try {
    const session = await requireProductionAccess();
    const [of_] = await db.select().from(ordresFabrication).where(eq(ordresFabrication.id, ofId)).limit(1);
    if (!of_) return { error: "Ordre de fabrication introuvable." };

    const sequence = sequencePour(of_.personnalise);
    const idxActuel = sequence.indexOf(of_.etape);
    const idxSuivant = sequence.indexOf(nextEtape);
    if (idxSuivant === -1) return { error: "Étape invalide pour cet OF." };
    if (idxSuivant !== idxActuel + 1) {
      return { error: "Transition d'étape invalide (ordre non respecté)." };
    }

    await db.transaction(async (tx) => {
      await tx.update(ordresFabrication).set({ etape: nextEtape }).where(eq(ordresFabrication.id, ofId));
      await enregistrerAudit(tx, {
        tableCible: "ordres_fabrication",
        enregistrementId: ofId,
        action: "MODIFICATION",
        utilisateurId: session.userId,
        details: { etape: nextEtape },
      });
    });

    revalidatePath("/production");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export async function assignerPilote(ofId: number, piloteId: number | null): Promise<{ error?: string }> {
  try {
    await requireProductionAccess();
    await db.update(ordresFabrication).set({ piloteId }).where(eq(ordresFabrication.id, ofId));
    revalidatePath("/production");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}
