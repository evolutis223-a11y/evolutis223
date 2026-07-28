"use server";

import { eq, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { affaires, clients, lignesAffaire } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import type { LigneInput } from "../affaires/actions";

async function requireCommercialAccess() {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Commercial")) {
    throw new Error("Accès refusé.");
  }
  return session;
}

async function genererNumeroProforma(): Promise<string> {
  const annee = new Date().getFullYear().toString().slice(-2);
  const like_ = `PRO-${annee}-%`;
  const rows = await db.select({ numero: affaires.numero }).from(affaires).where(like(affaires.numero, like_));
  const seq = rows.length + 1;
  return `PRO-${annee}-${seq.toString().padStart(4, "0")}`;
}

// §12 : les partenaires (Freelance, Commercial à distance) remplissent une proforma
// (fonctionnellement un Devis) qui part en validation Admin/Super Admin avant envoi au client —
// même logique de file d'attente que §9, mais sur affaires.statut plutôt que sur une table dédiée.
export async function creerProforma(
  clientNom: string,
  clientContact: string,
  lignes: LigneInput[]
): Promise<{ affaireId?: number; error?: string }> {
  try {
    const session = await requireCommercialAccess();
    const nom = clientNom.trim();
    const contact = clientContact.trim() || null;
    if (!nom) return { error: "Nom du client requis." };
    if (lignes.length === 0) return { error: "Au moins une ligne requise." };
    if (lignes.some((l) => !l.articleId || l.quantite <= 0)) {
      return { error: "Chaque ligne doit avoir un article et une quantité valide." };
    }

    const montantTtc = lignes.reduce((acc, l) => acc + l.quantite * l.prixUnitaire, 0);
    const numero = await genererNumeroProforma();

    const affaireId = await db.transaction(async (tx) => {
      let clientId: number;
      const existing = contact
        ? await tx.select().from(clients).where(eq(clients.contact, contact)).limit(1)
        : [];
      if (existing.length > 0) {
        clientId = existing[0].id;
      } else {
        const [created] = await tx.insert(clients).values({ typeClient: "BOUTIQUE", nom, contact }).returning();
        clientId = created.id;
      }

      const [affaire] = await tx
        .insert(affaires)
        .values({
          numero,
          type: "PROFORMA",
          statut: "EN_ATTENTE",
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

      return affaire.id;
    });

    revalidatePath("/commercial");
    revalidatePath("/validations");
    return { affaireId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}
