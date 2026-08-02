"use server";

import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bonsDecaissement } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { creerBonDecaissement } from "@/app/tresorerie/actions";

// §7 modules Dépenses/Charges — clarifiés par l'utilisateur (2026-08-02). Les deux noms du
// cahier des charges pointent vers la même catégorie de décaissement (CHARGE_GENERAL) : loyer,
// courant, transport, imprévus. Pas assez de différence spécifiée entre les deux pour justifier
// deux écrans séparés — consolidés ici, /depenses et /charges pointent tous les deux dessus.
async function requireAccess() {
  const session = await getSession();
  if (!session || !(hasModuleAccess(session.roleCode, "Dépenses") || hasModuleAccess(session.roleCode, "Charges"))) {
    throw new Error("Accès refusé.");
  }
  return session;
}

export async function chargerDonneesDepenses() {
  await requireAccess();

  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);

  const [bonRows, totalMoisRow] = await Promise.all([
    db
      .select({
        id: bonsDecaissement.id,
        montant: bonsDecaissement.montant,
        motif: bonsDecaissement.motif,
        dateCreation: bonsDecaissement.dateCreation,
        valide: isNotNull(bonsDecaissement.validateurId),
      })
      .from(bonsDecaissement)
      .where(eq(bonsDecaissement.categorie, "CHARGE_GENERAL"))
      .orderBy(desc(bonsDecaissement.dateCreation))
      .limit(50),
    db
      .select({ total: sql<string>`coalesce(sum(${bonsDecaissement.montant}), 0)` })
      .from(bonsDecaissement)
      .where(
        and(
          eq(bonsDecaissement.categorie, "CHARGE_GENERAL"),
          isNotNull(bonsDecaissement.validateurId),
          gte(bonsDecaissement.dateCreation, debutMois)
        )
      ),
  ]);

  return {
    bons: bonRows.map((b) => ({ ...b, montant: Number(b.montant), valide: Boolean(b.valide) })),
    totalMois: Number(totalMoisRow[0].total),
  };
}

export interface DepenseBonState {
  error: string | null;
}

export async function creerDepense(_prev: DepenseBonState, formData: FormData): Promise<DepenseBonState> {
  const montant = String(formData.get("montant") ?? "");
  const motif = String(formData.get("motif") ?? "");
  const fd = new FormData();
  fd.set("categorie", "CHARGE_GENERAL");
  fd.set("montant", montant);
  fd.set("motif", motif);
  const res = await creerBonDecaissement({ error: null }, fd);
  if (!res.error) {
    revalidatePath("/depenses");
    revalidatePath("/charges");
  }
  return { error: res.error ?? null };
}
