"use server";

import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { affaires, bulletinsPaie, personnel, utilisateurs } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { creerBonDecaissement } from "@/app/tresorerie/actions";

async function requireRhAccess() {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "RH")) {
    throw new Error("Accès refusé.");
  }
  return session;
}

export async function chargerDonneesRh() {
  const [personnelRows, bulletinRows, utilisateurRows] = await Promise.all([
    db.select().from(personnel).orderBy(personnel.nom),
    db
      .select({
        id: bulletinsPaie.id,
        personnelId: bulletinsPaie.personnelId,
        periode: bulletinsPaie.periode,
        salaireBase: bulletinsPaie.salaireBase,
        primeTransport: bulletinsPaie.primeTransport,
        commission: bulletinsPaie.commission,
        retenueInps: bulletinsPaie.retenueInps,
        avance: bulletinsPaie.avance,
        netAPayer: bulletinsPaie.netAPayer,
        statut: bulletinsPaie.statut,
        dateCreation: bulletinsPaie.dateCreation,
        datePaiement: bulletinsPaie.datePaiement,
        personnelNom: personnel.nom,
      })
      .from(bulletinsPaie)
      .innerJoin(personnel, eq(personnel.id, bulletinsPaie.personnelId))
      .orderBy(desc(bulletinsPaie.dateCreation))
      .limit(100),
    db.select({ id: utilisateurs.id, nom: utilisateurs.nom }).from(utilisateurs).where(eq(utilisateurs.actif, true)),
  ]);

  return {
    personnel: personnelRows.map((p) => ({
      ...p,
      salaireBase: Number(p.salaireBase),
      tauxCommission: p.tauxCommission ? Number(p.tauxCommission) : null,
    })),
    bulletins: bulletinRows.map((b) => ({
      ...b,
      salaireBase: Number(b.salaireBase),
      primeTransport: Number(b.primeTransport),
      commission: Number(b.commission),
      retenueInps: Number(b.retenueInps),
      avance: Number(b.avance),
      netAPayer: Number(b.netAPayer),
    })),
    utilisateurs: utilisateurRows,
  };
}

export interface PersonnelState {
  error: string | null;
  personnelId?: number;
}

export async function ajouterPersonnel(_prev: PersonnelState, formData: FormData): Promise<PersonnelState> {
  try {
    await requireRhAccess();
    const nom = String(formData.get("nom") ?? "").trim();
    const telephone = String(formData.get("telephone") ?? "").trim();
    const fonction = String(formData.get("fonction") ?? "").trim();
    const typeContrat = String(formData.get("typeContrat") ?? "");
    const salaireBase = Number(formData.get("salaireBase") || 0);
    const tauxCommissionRaw = String(formData.get("tauxCommission") ?? "").trim();
    const utilisateurIdRaw = String(formData.get("utilisateurId") ?? "").trim();
    const dateEmbaucheRaw = String(formData.get("dateEmbauche") ?? "").trim();

    if (!nom) return { error: "Nom requis." };
    if (!["SALARIE", "JOURNALIER", "PARTENAIRE"].includes(typeContrat)) return { error: "Type de contrat invalide." };
    if (!Number.isFinite(salaireBase) || salaireBase < 0) return { error: "Salaire de base invalide." };

    const [created] = await db
      .insert(personnel)
      .values({
        nom,
        telephone: telephone || null,
        fonction: fonction || null,
        typeContrat,
        salaireBase: salaireBase.toFixed(2),
        tauxCommission: tauxCommissionRaw ? Number(tauxCommissionRaw).toFixed(2) : null,
        utilisateurId: utilisateurIdRaw ? Number(utilisateurIdRaw) : null,
        dateEmbauche: dateEmbaucheRaw || null,
      })
      .returning();
    revalidatePath("/rh");
    return { error: null, personnelId: created.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur." };
  }
}

export async function basculerActifPersonnel(id: number, actif: boolean) {
  await requireRhAccess();
  await db.update(personnel).set({ actif }).where(eq(personnel.id, id));
  revalidatePath("/rh");
}

function bornesPeriode(periode: string) {
  const [annee, mois] = periode.split("-").map(Number);
  const debut = new Date(annee, mois - 1, 1);
  const fin = new Date(annee, mois, 1);
  return { debut, fin };
}

export async function calculerCommissionSuggeree(personnelId: number, periode: string): Promise<number> {
  await requireRhAccess();
  const [p] = await db.select().from(personnel).where(eq(personnel.id, personnelId)).limit(1);
  if (!p || !p.utilisateurId || !p.tauxCommission) return 0;

  const { debut, fin } = bornesPeriode(periode);
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${affaires.montantTtc}), 0)` })
    .from(affaires)
    .where(and(eq(affaires.auteurId, p.utilisateurId), gte(affaires.dateCreation, debut), lt(affaires.dateCreation, fin)));

  return Number(row.total) * (Number(p.tauxCommission) / 100);
}

export interface BulletinInput {
  personnelId: number;
  periode: string;
  salaireBase: number;
  primeTransport: number;
  commission: number;
  retenueInps: number;
  avance: number;
}

export interface BulletinResult {
  error?: string;
  bulletinId?: number;
}

export async function genererBulletin(input: BulletinInput): Promise<BulletinResult> {
  try {
    const session = await requireRhAccess();
    if (!/^\d{4}-\d{2}$/.test(input.periode)) return { error: "Période invalide." };
    const netAPayer = input.salaireBase + input.primeTransport + input.commission - input.retenueInps - input.avance;

    const [existing] = await db
      .select()
      .from(bulletinsPaie)
      .where(and(eq(bulletinsPaie.personnelId, input.personnelId), eq(bulletinsPaie.periode, input.periode)))
      .limit(1);

    if (existing) {
      if (existing.statut === "PAYE") return { error: "Ce bulletin est déjà payé — non modifiable." };
      await db
        .update(bulletinsPaie)
        .set({
          salaireBase: input.salaireBase.toFixed(2),
          primeTransport: input.primeTransport.toFixed(2),
          commission: input.commission.toFixed(2),
          retenueInps: input.retenueInps.toFixed(2),
          avance: input.avance.toFixed(2),
          netAPayer: netAPayer.toFixed(2),
        })
        .where(eq(bulletinsPaie.id, existing.id));
      revalidatePath("/rh");
      return { bulletinId: existing.id };
    }

    const [created] = await db
      .insert(bulletinsPaie)
      .values({
        personnelId: input.personnelId,
        periode: input.periode,
        salaireBase: input.salaireBase.toFixed(2),
        primeTransport: input.primeTransport.toFixed(2),
        commission: input.commission.toFixed(2),
        retenueInps: input.retenueInps.toFixed(2),
        avance: input.avance.toFixed(2),
        netAPayer: netAPayer.toFixed(2),
        auteurId: session.userId,
      })
      .returning();
    revalidatePath("/rh");
    return { bulletinId: created.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur." };
  }
}

export async function marquerBulletinPaye(bulletinId: number): Promise<{ error?: string }> {
  try {
    await requireRhAccess();
    const [bulletin] = await db.select().from(bulletinsPaie).where(eq(bulletinsPaie.id, bulletinId)).limit(1);
    if (!bulletin) return { error: "Bulletin introuvable." };
    if (bulletin.statut === "PAYE") return { error: "Déjà payé." };
    if (Number(bulletin.netAPayer) <= 0) return { error: "Net à payer doit être positif." };

    const [p] = await db.select().from(personnel).where(eq(personnel.id, bulletin.personnelId)).limit(1);

    const fd = new FormData();
    fd.set("categorie", "RH_SALAIRE");
    fd.set("montant", bulletin.netAPayer);
    fd.set("motif", `Paie ${bulletin.periode} — ${p?.nom ?? "personnel #" + bulletin.personnelId}`);
    const res = await creerBonDecaissement({ error: null }, fd);
    if (res.error || !res.bonId) return { error: res.error ?? "Échec de création du bon de décaissement." };

    await db
      .update(bulletinsPaie)
      .set({ statut: "PAYE", datePaiement: new Date(), decaissementId: res.bonId })
      .where(eq(bulletinsPaie.id, bulletinId));

    revalidatePath("/rh");
    revalidatePath("/tresorerie");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur." };
  }
}
