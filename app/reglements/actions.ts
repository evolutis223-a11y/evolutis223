"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { affaires, reglements } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { eq } from "drizzle-orm";

async function requireReglementsAccess() {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Règlements")) {
    throw new Error("Accès refusé.");
  }
  return session;
}

export interface ReglementLibreState {
  error: string | null;
  savedToAttente?: boolean;
}

// Fiche de règlement (maquette, module Règlements) : l'affaire liée est facultative — sans elle,
// l'encaissement est déduit sans mise à jour de solde d'affaire ("Compte d'attente" côté maquette :
// ici représenté par un règlement affaire_id = NULL, en attente de rattachement ultérieur).
export async function enregistrerReglement(
  _prevState: ReglementLibreState,
  formData: FormData
): Promise<ReglementLibreState> {
  const session = await requireReglementsAccess();

  const affaireIdRaw = formData.get("affaireId");
  const affaireId = affaireIdRaw && String(affaireIdRaw).trim() !== "" ? Number(affaireIdRaw) : null;
  const nom = String(formData.get("nom") ?? "").trim();
  const prenom = String(formData.get("prenom") ?? "").trim();
  const telephone = String(formData.get("telephone") ?? "").trim();
  const montant = Number(formData.get("montant"));
  const mode = String(formData.get("mode") ?? "");
  const reference = String(formData.get("reference") ?? "").trim();
  const commentaire = String(formData.get("commentaire") ?? "").trim();

  if (!Number.isFinite(montant) || montant <= 0) return { error: "Montant invalide." };
  if (!["ESPECES", "MOBILE_MONEY", "VIREMENT", "CHEQUE"].includes(mode)) {
    return { error: "Mode de règlement invalide." };
  }
  if (affaireId != null) {
    const [affaire] = await db.select({ id: affaires.id }).from(affaires).where(eq(affaires.id, affaireId)).limit(1);
    if (!affaire) return { error: "Affaire introuvable." };
  }

  await db.insert(reglements).values({
    affaireId,
    payeurNom: nom || null,
    payeurPrenom: prenom || null,
    payeurTelephone: telephone || null,
    reference: reference || null,
    commentaire: commentaire || null,
    montant: montant.toFixed(2),
    mode,
    auteurId: session.userId,
  });

  revalidatePath("/reglements");
  revalidatePath("/affaires");
  revalidatePath("/documents");
  return { error: null, savedToAttente: affaireId == null };
}
