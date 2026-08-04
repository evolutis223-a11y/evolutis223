"use server";

import bcrypt from "bcryptjs";
import { db } from "@/db";
import { demandesAcces } from "@/db/schema";

export interface DemandeAccesState {
  error: string | null;
  success?: boolean;
}

export async function demanderAcces(_prev: DemandeAccesState, formData: FormData): Promise<DemandeAccesState> {
  const nom = String(formData.get("nom") ?? "").trim();
  const telephone = String(formData.get("telephone") ?? "").trim().replace(/\s+/g, "");
  const pin = String(formData.get("pin") ?? "").trim();
  const posteVise = String(formData.get("posteVise") ?? "").trim();

  if (!nom) return { error: "Nom requis." };
  if (!telephone) return { error: "Téléphone requis." };
  if (!/^\d{4,8}$/.test(pin)) return { error: "PIN requis (4 à 8 chiffres)." };

  const pinHash = await bcrypt.hash(pin, 10);

  await db.insert(demandesAcces).values({
    nom,
    telephone,
    pinHash,
    posteVise: posteVise || null,
  });

  return { error: null, success: true };
}
