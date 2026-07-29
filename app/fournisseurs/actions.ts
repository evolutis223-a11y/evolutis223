"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { fournisseurs } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";

export interface CreateFournisseurState {
  error: string | null;
}

async function requireFournisseursAccess() {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Fournisseurs")) {
    throw new Error("Accès refusé.");
  }
  return session;
}

export async function createFournisseur(
  _prevState: CreateFournisseurState,
  formData: FormData
): Promise<CreateFournisseurState> {
  try {
    await requireFournisseursAccess();
  } catch {
    return { error: "Accès refusé." };
  }

  const nom = String(formData.get("nom") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const delaiRaw = String(formData.get("delaiLivraisonJours") ?? "").trim();

  if (!nom) return { error: "Nom requis." };
  const delaiLivraisonJours = delaiRaw ? Number(delaiRaw) : null;
  if (delaiLivraisonJours !== null && (!Number.isFinite(delaiLivraisonJours) || delaiLivraisonJours < 0)) {
    return { error: "Délai de livraison invalide." };
  }

  await db.insert(fournisseurs).values({
    nom,
    contact: contact || null,
    delaiLivraisonJours,
  });

  revalidatePath("/fournisseurs");
  return { error: null };
}

export async function toggleFournisseurActif(fournisseurId: number, next: boolean) {
  await requireFournisseursAccess();
  await db.update(fournisseurs).set({ actif: next }).where(eq(fournisseurs.id, fournisseurId));
  revalidatePath("/fournisseurs");
}
