"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { fondsCirculation, reglements } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { enregistrerAudit } from "@/lib/audit";

async function requireTresorerieAccess() {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Trésorerie")) {
    throw new Error("Accès refusé.");
  }
  return session;
}

// §8.2 points 5-7 : rapprochement montant remis / attendu — c'est seulement à la validation que
// le montant impacte la Trésorerie centrale (insertion dans reglements). Tout écart est tracé.
export async function validerRemise(fondsId: number, montantRemis: number): Promise<{ error?: string }> {
  try {
    const session = await requireTresorerieAccess();
    const [fonds] = await db.select().from(fondsCirculation).where(eq(fondsCirculation.id, fondsId)).limit(1);
    if (!fonds) return { error: "Fonds introuvable." };
    if (fonds.statut !== "EN_CIRCULATION") return { error: "Cette remise est déjà traitée." };
    if (!Number.isFinite(montantRemis) || montantRemis < 0) return { error: "Montant invalide." };

    const ecart = montantRemis - Number(fonds.montantAttendu);

    await db.transaction(async (tx) => {
      await tx.insert(reglements).values({
        affaireId: fonds.affaireId,
        montant: montantRemis.toFixed(2),
        mode: "ESPECES",
        auteurId: session.userId,
      });
      await tx
        .update(fondsCirculation)
        .set({
          statut: "VALIDE",
          montantRemis: montantRemis.toFixed(2),
          validateurId: session.userId,
          dateRemise: new Date(),
        })
        .where(eq(fondsCirculation.id, fondsId));
      await enregistrerAudit(tx, {
        tableCible: "fonds_circulation",
        enregistrementId: fondsId,
        action: "VALIDATION",
        utilisateurId: session.userId,
        details: { montantAttendu: fonds.montantAttendu, montantRemis, ecart },
      });
    });

    revalidatePath("/fonds-circulation");
    revalidatePath("/tresorerie");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}
