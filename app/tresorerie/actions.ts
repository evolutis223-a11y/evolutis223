"use server";

import { and, eq, gte, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bonsDecaissement, cloturesCaisse, reglements } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";

async function requireTresorerieAccess() {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Trésorerie")) {
    throw new Error("Accès refusé.");
  }
  return session;
}

export interface BonState {
  error: string | null;
}

const CATEGORIES = ["ACHAT_MARCHANDISE", "CHARGE_GENERAL", "RH_SALAIRE"] as const;

export async function creerBonDecaissement(
  _prevState: BonState,
  formData: FormData
): Promise<BonState> {
  const session = await requireTresorerieAccess();
  const categorie = String(formData.get("categorie") ?? "");
  const montant = Number(formData.get("montant"));
  const motif = String(formData.get("motif") ?? "").trim();

  if (!CATEGORIES.includes(categorie as (typeof CATEGORIES)[number])) {
    return { error: "Catégorie invalide." };
  }
  if (!Number.isFinite(montant) || montant <= 0) return { error: "Montant invalide." };
  if (!motif) return { error: "Motif requis." };

  await db.insert(bonsDecaissement).values({
    categorie,
    montant: montant.toFixed(2),
    motif,
    auteurId: session.userId,
  });

  revalidatePath("/tresorerie");
  return { error: null };
}

export async function validerBonDecaissement(bonId: number): Promise<{ error?: string }> {
  const session = await requireTresorerieAccess();
  await db.update(bonsDecaissement).set({ validateurId: session.userId }).where(eq(bonsDecaissement.id, bonId));
  revalidatePath("/tresorerie");
  return {};
}

function debutFin(date: Date) {
  const debut = new Date(date);
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 1);
  return { debut, fin };
}

export async function calculerSoldeTheorique(date: Date): Promise<number> {
  const { debut, fin } = debutFin(date);

  const [encaisse] = await db
    .select({ total: sql<string>`coalesce(sum(${reglements.montant}), 0)` })
    .from(reglements)
    .where(and(eq(reglements.mode, "ESPECES"), gte(reglements.dateReglement, debut), lt(reglements.dateReglement, fin)));

  const [decaisse] = await db
    .select({ total: sql<string>`coalesce(sum(${bonsDecaissement.montant}), 0)` })
    .from(bonsDecaissement)
    .where(and(gte(bonsDecaissement.dateCreation, debut), lt(bonsDecaissement.dateCreation, fin)));

  return Number(encaisse.total) - Number(decaisse.total);
}

export interface ClotureState {
  error: string | null;
}

export async function cloturerCaisse(
  _prevState: ClotureState,
  formData: FormData
): Promise<ClotureState> {
  const session = await requireTresorerieAccess();
  const comptageReel = Number(formData.get("comptageReel"));
  const justification = String(formData.get("justification") ?? "").trim();

  if (!Number.isFinite(comptageReel) || comptageReel < 0) return { error: "Comptage invalide." };

  const today = new Date();
  const soldeTheorique = await calculerSoldeTheorique(today);
  const ecart = comptageReel - soldeTheorique;
  if (Math.abs(ecart) > 0.01 && !justification) {
    return { error: "Écart détecté — justification requise." };
  }

  const dateCloture = today.toISOString().slice(0, 10);

  try {
    await db.insert(cloturesCaisse).values({
      dateCloture,
      soldeTheorique: soldeTheorique.toFixed(2),
      comptageReel: comptageReel.toFixed(2),
      justification: justification || null,
      auteurId: session.userId,
    });
  } catch {
    return { error: "La caisse du jour est déjà clôturée." };
  }

  revalidatePath("/tresorerie");
  return { error: null };
}
