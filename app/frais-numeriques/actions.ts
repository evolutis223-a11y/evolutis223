"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { fraisNumeriques } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";

// Taux indicatif (2026-08-02) — sert juste à donner un ordre de grandeur en FCFA pour des coûts
// facturés en USD. Pas de suivi historique du taux : ce registre est un aide-mémoire personnel,
// pas une pièce comptable soumise au seuil de validation (§16.7, voir /depenses pour ça).
const TAUX_XOF_PAR_USD = 569;

async function requireAccess() {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Frais numériques")) {
    throw new Error("Accès refusé.");
  }
  return session;
}

function convertir(montant: number, devise: string) {
  if (devise === "USD") {
    return { montantUsd: montant, montantFcfa: montant * TAUX_XOF_PAR_USD };
  }
  return { montantUsd: montant / TAUX_XOF_PAR_USD, montantFcfa: montant };
}

export async function chargerFraisNumeriques() {
  await requireAccess();

  const rows = await db.select().from(fraisNumeriques).orderBy(desc(fraisNumeriques.dateCreation));

  const lignes = rows.map((r) => {
    const montant = Number(r.montant);
    const { montantUsd, montantFcfa } = convertir(montant, r.devise);
    return { ...r, montant, montantUsd, montantFcfa };
  });

  let totalMensuelFcfa = 0;
  let totalUniqueFcfa = 0;
  for (const l of lignes) {
    if (l.statut !== "ACTIF") continue;
    if (l.frequence === "MENSUEL") totalMensuelFcfa += l.montantFcfa;
    else if (l.frequence === "ANNUEL") totalMensuelFcfa += l.montantFcfa / 12;
    else totalUniqueFcfa += l.montantFcfa;
  }

  return {
    lignes,
    totalMensuelFcfa,
    totalUniqueFcfa,
    tauxXofParUsd: TAUX_XOF_PAR_USD,
  };
}

export interface FraisNumeriqueState {
  error: string | null;
}

export async function creerFraisNumerique(_prev: FraisNumeriqueState, formData: FormData): Promise<FraisNumeriqueState> {
  const session = await requireAccess();

  const libelle = String(formData.get("libelle") ?? "").trim();
  const categorie = String(formData.get("categorie") ?? "");
  const devise = String(formData.get("devise") ?? "");
  const montant = Number(formData.get("montant"));
  const frequence = String(formData.get("frequence") ?? "");
  const statut = String(formData.get("statut") ?? "PREVU");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!libelle || !Number.isFinite(montant) || montant <= 0) {
    return { error: "Libellé et montant valides requis." };
  }
  if (!["DOMAINE", "HEBERGEMENT", "OUTILS_IA", "PAIEMENT_LIGNE", "BOUTIQUE", "AUTRE"].includes(categorie)) {
    return { error: "Catégorie invalide." };
  }
  if (!["USD", "FCFA"].includes(devise)) {
    return { error: "Devise invalide." };
  }
  if (!["UNIQUE", "MENSUEL", "ANNUEL"].includes(frequence)) {
    return { error: "Fréquence invalide." };
  }

  await db.insert(fraisNumeriques).values({
    libelle,
    categorie,
    devise,
    montant: montant.toFixed(2),
    frequence,
    statut: statut === "ACTIF" ? "ACTIF" : "PREVU",
    notes: notes || null,
    auteurId: session.userId,
  });

  revalidatePath("/frais-numeriques");
  return { error: null };
}

export async function basculerStatutFrais(id: number) {
  await requireAccess();
  const [row] = await db.select({ statut: fraisNumeriques.statut }).from(fraisNumeriques).where(eq(fraisNumeriques.id, id));
  if (!row) return;
  await db
    .update(fraisNumeriques)
    .set({ statut: row.statut === "ACTIF" ? "PREVU" : "ACTIF" })
    .where(eq(fraisNumeriques.id, id));
  revalidatePath("/frais-numeriques");
}

export async function supprimerFraisNumerique(id: number) {
  await requireAccess();
  await db.delete(fraisNumeriques).where(eq(fraisNumeriques.id, id));
  revalidatePath("/frais-numeriques");
}
