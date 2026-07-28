"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";

export interface CreateClientState {
  error: string | null;
}

const TYPES = ["BOUTIQUE", "ONG_CONTRAT"] as const;

export async function createClient(
  _prevState: CreateClientState,
  formData: FormData
): Promise<CreateClientState> {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Clients")) {
    return { error: "Accès refusé." };
  }

  const typeClient = String(formData.get("typeClient") ?? "");
  const nom = String(formData.get("nom") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const contratRef = String(formData.get("contratRef") ?? "").trim();
  const paiementDiffereJoursRaw = String(formData.get("paiementDiffereJours") ?? "").trim();

  if (!nom) return { error: "Nom requis." };
  if (!TYPES.includes(typeClient as (typeof TYPES)[number])) {
    return { error: "Type de client requis." };
  }

  const paiementDiffereJours = paiementDiffereJoursRaw ? Number(paiementDiffereJoursRaw) : null;
  if (paiementDiffereJours !== null && (!Number.isFinite(paiementDiffereJours) || paiementDiffereJours < 0)) {
    return { error: "Délai de paiement invalide." };
  }

  await db.insert(clients).values({
    typeClient,
    nom,
    contact: contact || null,
    contratRef: typeClient === "ONG_CONTRAT" ? contratRef || null : null,
    paiementDiffereJours: typeClient === "ONG_CONTRAT" ? paiementDiffereJours : null,
  });

  revalidatePath("/clients");
  return { error: null };
}
