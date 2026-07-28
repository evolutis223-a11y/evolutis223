"use server";

import { and, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bonsDecaissement, cloturesCaisse, parametresTresorerie, reglements } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";

async function requireTresorerieAccess() {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Trésorerie")) {
    throw new Error("Accès refusé.");
  }
  return session;
}

async function seuilValidation(): Promise<number> {
  const [row] = await db.select().from(parametresTresorerie).limit(1);
  return row ? Number(row.seuilValidationDecaissement) : 50000;
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

  // §8.2 point 2 / §16.7 : en dessous du seuil, auto-validé par l'auteur — au-delà, validation
  // hiérarchique obligatoire (quelqu'un d'autre) avant d'impacter la caisse (calculerSoldeTheorique).
  const seuil = await seuilValidation();
  const autoValide = montant <= seuil;

  await db.insert(bonsDecaissement).values({
    categorie,
    montant: montant.toFixed(2),
    motif,
    auteurId: session.userId,
    validateurId: autoValide ? session.userId : null,
  });

  revalidatePath("/tresorerie");
  return { error: null };
}

export async function validerBonDecaissement(bonId: number): Promise<{ error?: string }> {
  const session = await requireTresorerieAccess();
  const [bon] = await db.select().from(bonsDecaissement).where(eq(bonsDecaissement.id, bonId)).limit(1);
  if (!bon) return { error: "Bon introuvable." };
  if (bon.validateurId) return { error: "Ce bon est déjà validé." };

  const seuil = await seuilValidation();
  if (Number(bon.montant) > seuil && bon.auteurId === session.userId) {
    return { error: "Validation hiérarchique requise — un autre utilisateur doit valider ce bon." };
  }

  await db.update(bonsDecaissement).set({ validateurId: session.userId }).where(eq(bonsDecaissement.id, bonId));
  revalidatePath("/tresorerie");
  return {};
}

export async function definirSeuilDecaissement(nouveauSeuil: number): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.roleCode)) {
    return { error: "Accès réservé à Admin/Super Admin." };
  }
  if (!Number.isFinite(nouveauSeuil) || nouveauSeuil < 0) return { error: "Seuil invalide." };

  const [existing] = await db.select().from(parametresTresorerie).limit(1);
  if (existing) {
    await db
      .update(parametresTresorerie)
      .set({ seuilValidationDecaissement: nouveauSeuil.toFixed(2), modifiePar: session.userId, dateModification: new Date() })
      .where(eq(parametresTresorerie.id, existing.id));
  } else {
    await db.insert(parametresTresorerie).values({
      seuilValidationDecaissement: nouveauSeuil.toFixed(2),
      modifiePar: session.userId,
    });
  }

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

  // §8.2 point 2 : un bon n'impacte la caisse qu'une fois validé (auto ou hiérarchique, §16.7) —
  // "validation hiérarchique obligatoire avant exécution", pas juste avant clôture.
  const [decaisse] = await db
    .select({ total: sql<string>`coalesce(sum(${bonsDecaissement.montant}), 0)` })
    .from(bonsDecaissement)
    .where(
      and(
        isNotNull(bonsDecaissement.validateurId),
        gte(bonsDecaissement.dateCreation, debut),
        lt(bonsDecaissement.dateCreation, fin)
      )
    );

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
