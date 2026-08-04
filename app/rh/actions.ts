"use server";

import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  affaires,
  avancesPersonnel,
  besoinsSaisonniers,
  bulletinsPaie,
  incidentsPersonnel,
  personnel,
  pretsPersonnel,
  utilisateurs,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { creerBonDecaissement } from "@/app/tresorerie/actions";

async function genererMatricule(): Promise<string> {
  const [row] = await db.select({ n: sql<string>`count(*)` }).from(personnel);
  const seq = Number(row.n) + 1;
  return `EMP-${seq.toString().padStart(4, "0")}`;
}

async function requireRhAccess() {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "RH")) {
    throw new Error("Accès refusé.");
  }
  return session;
}

export async function chargerDonneesRh() {
  const [personnelRows, bulletinRows, utilisateurRows, incidentRows, besoinRows, pretRows, avanceRows] = await Promise.all([
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
    db
      .select({
        id: incidentsPersonnel.id,
        personnelId: incidentsPersonnel.personnelId,
        personnelNom: personnel.nom,
        type: incidentsPersonnel.type,
        dateIncident: incidentsPersonnel.dateIncident,
        description: incidentsPersonnel.description,
        impact: incidentsPersonnel.impact,
        obligationsLegales: incidentsPersonnel.obligationsLegales,
        statut: incidentsPersonnel.statut,
      })
      .from(incidentsPersonnel)
      .innerJoin(personnel, eq(personnel.id, incidentsPersonnel.personnelId))
      .orderBy(desc(incidentsPersonnel.dateIncident))
      .limit(100),
    db.select().from(besoinsSaisonniers).orderBy(desc(besoinsSaisonniers.periodeDebut)).limit(100),
    db.select().from(pretsPersonnel).where(eq(pretsPersonnel.statut, "ACTIF")).orderBy(desc(pretsPersonnel.dateCreation)),
    db.select().from(avancesPersonnel).where(eq(avancesPersonnel.statut, "ACTIVE")).orderBy(desc(avancesPersonnel.date)),
  ]);

  // Un seul prêt/avance actif affiché par personnel (le plus récent) — cohérent avec la fiche
  // employé de la maquette qui ne montre qu'un bloc "Prêt en cours" / "Avance sur salaire" à la fois.
  const pretActifParPersonnel = new Map<number, (typeof pretRows)[number]>();
  for (const p of pretRows) if (!pretActifParPersonnel.has(p.personnelId)) pretActifParPersonnel.set(p.personnelId, p);
  const avanceActiveParPersonnel = new Map<number, (typeof avanceRows)[number]>();
  for (const a of avanceRows) if (!avanceActiveParPersonnel.has(a.personnelId)) avanceActiveParPersonnel.set(a.personnelId, a);

  return {
    personnel: personnelRows.map((p) => {
      const pret = pretActifParPersonnel.get(p.id);
      const avance = avanceActiveParPersonnel.get(p.id);
      return {
        ...p,
        salaireBase: Number(p.salaireBase),
        tauxCommission: p.tauxCommission ? Number(p.tauxCommission) : null,
        pretActif: pret
          ? { id: pret.id, montant: Number(pret.montant), mensualite: Number(pret.mensualite), soldeRestant: Number(pret.soldeRestant) }
          : null,
        avanceActive: avance ? { id: avance.id, montant: Number(avance.montant), date: avance.date } : null,
      };
    }),
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
    incidents: incidentRows,
    besoins: besoinRows,
  };
}

export interface IncidentState {
  error: string | null;
  incidentId?: number;
}

export async function declarerIncident(_prev: IncidentState, formData: FormData): Promise<IncidentState> {
  try {
    const session = await requireRhAccess();
    const personnelId = Number(formData.get("personnelId"));
    const type = String(formData.get("type") ?? "");
    const dateIncident = String(formData.get("dateIncident") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const impact = String(formData.get("impact") ?? "").trim();
    const obligationsLegales = String(formData.get("obligationsLegales") ?? "").trim();

    if (!personnelId) return { error: "Personnel requis." };
    if (!["MALADIE", "BLESSURE", "DECES", "CATASTROPHE_NATURELLE", "BLOCAGE_RECRUTEMENT", "AUTRE"].includes(type)) {
      return { error: "Type d'incident invalide." };
    }
    if (!dateIncident) return { error: "Date requise." };

    const [created] = await db
      .insert(incidentsPersonnel)
      .values({
        personnelId,
        type,
        dateIncident,
        description: description || null,
        impact: impact || null,
        obligationsLegales: obligationsLegales || null,
        auteurId: session.userId,
      })
      .returning();
    revalidatePath("/rh");
    return { error: null, incidentId: created.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur." };
  }
}

export async function changerStatutIncident(id: number, statut: string) {
  await requireRhAccess();
  if (!["DECLARE", "EN_COURS", "RESOLU"].includes(statut)) return;
  await db.update(incidentsPersonnel).set({ statut }).where(eq(incidentsPersonnel.id, id));
  revalidatePath("/rh");
}

export interface BesoinState {
  error: string | null;
  besoinId?: number;
}

export async function ajouterBesoinSaisonnier(_prev: BesoinState, formData: FormData): Promise<BesoinState> {
  try {
    const session = await requireRhAccess();
    const titre = String(formData.get("titre") ?? "").trim();
    const fonction = String(formData.get("fonction") ?? "").trim();
    const nombrePersonnesRequis = Number(formData.get("nombrePersonnesRequis") || 1);
    const periodeDebut = String(formData.get("periodeDebut") ?? "").trim();
    const periodeFin = String(formData.get("periodeFin") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    if (!titre) return { error: "Titre requis." };
    if (!periodeDebut || !periodeFin) return { error: "Période requise." };
    if (!Number.isFinite(nombrePersonnesRequis) || nombrePersonnesRequis < 1) return { error: "Nombre de personnes invalide." };

    const [created] = await db
      .insert(besoinsSaisonniers)
      .values({
        titre,
        fonction: fonction || null,
        nombrePersonnesRequis,
        periodeDebut,
        periodeFin,
        notes: notes || null,
        auteurId: session.userId,
      })
      .returning();
    revalidatePath("/rh");
    return { error: null, besoinId: created.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur." };
  }
}

export async function changerStatutBesoin(id: number, statut: string) {
  await requireRhAccess();
  if (!["PLANIFIE", "EN_COURS", "POURVU", "ANNULE"].includes(statut)) return;
  await db.update(besoinsSaisonniers).set({ statut }).where(eq(besoinsSaisonniers.id, id));
  revalidatePath("/rh");
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
    const email = String(formData.get("email") ?? "").trim();
    const fonction = String(formData.get("fonction") ?? "").trim();
    const departement = String(formData.get("departement") ?? "").trim();
    const typeContrat = String(formData.get("typeContrat") ?? "");
    const dureeContrat = String(formData.get("dureeContrat") ?? "").trim();
    const salaireBase = Number(formData.get("salaireBase") || 0);
    const tauxCommissionRaw = String(formData.get("tauxCommission") ?? "").trim();
    const utilisateurIdRaw = String(formData.get("utilisateurId") ?? "").trim();
    const dateEmbaucheRaw = String(formData.get("dateEmbauche") ?? "").trim();

    if (!nom) return { error: "Nom requis." };
    if (!["SALARIE", "JOURNALIER", "PARTENAIRE"].includes(typeContrat)) return { error: "Type de contrat invalide." };
    if (dureeContrat && !["CDI", "CDD", "Stagiaire"].includes(dureeContrat)) return { error: "Durée de contrat invalide." };
    if (!Number.isFinite(salaireBase) || salaireBase < 0) return { error: "Salaire de base invalide." };

    const matricule = await genererMatricule();
    const [created] = await db
      .insert(personnel)
      .values({
        matricule,
        nom,
        telephone: telephone || null,
        email: email || null,
        fonction: fonction || null,
        departement: departement || null,
        typeContrat,
        dureeContrat: typeContrat === "SALARIE" && dureeContrat ? dureeContrat : null,
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

// Prêt et avance sortent réellement de la caisse au moment où ils sont accordés (pas à la
// résorption) — même logique de bon de décaissement que la paie, catégorie RH_SALAIRE faute de
// catégorie dédiée dans bons_decaissement (§16.7, motif explicite pour la traçabilité).
export async function accorderPret(personnelId: number, montant: number, mensualite: number): Promise<{ error?: string }> {
  try {
    const session = await requireRhAccess();
    if (!Number.isFinite(montant) || montant <= 0) return { error: "Montant du prêt invalide." };
    if (!Number.isFinite(mensualite) || mensualite <= 0) return { error: "Mensualité invalide." };

    const [p] = await db.select().from(personnel).where(eq(personnel.id, personnelId)).limit(1);
    if (!p) return { error: "Personnel introuvable." };

    const fd = new FormData();
    fd.set("categorie", "RH_SALAIRE");
    fd.set("montant", montant.toFixed(2));
    fd.set("motif", `Prêt personnel — ${p.nom}`);
    const res = await creerBonDecaissement({ error: null }, fd);
    if (res.error || !res.bonId) return { error: res.error ?? "Échec de création du bon de décaissement." };

    await db.insert(pretsPersonnel).values({
      personnelId,
      montant: montant.toFixed(2),
      mensualite: mensualite.toFixed(2),
      soldeRestant: montant.toFixed(2),
      auteurId: session.userId,
    });
    revalidatePath("/rh");
    revalidatePath("/tresorerie");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur." };
  }
}

export async function soldePret(pretId: number): Promise<{ error?: string }> {
  await requireRhAccess();
  await db.update(pretsPersonnel).set({ statut: "SOLDE", soldeRestant: "0" }).where(eq(pretsPersonnel.id, pretId));
  revalidatePath("/rh");
  return {};
}

export async function accorderAvance(personnelId: number, montant: number): Promise<{ error?: string }> {
  try {
    const session = await requireRhAccess();
    if (!Number.isFinite(montant) || montant <= 0) return { error: "Montant de l'avance invalide." };

    const [p] = await db.select().from(personnel).where(eq(personnel.id, personnelId)).limit(1);
    if (!p) return { error: "Personnel introuvable." };

    const fd = new FormData();
    fd.set("categorie", "RH_SALAIRE");
    fd.set("montant", montant.toFixed(2));
    fd.set("motif", `Avance sur salaire — ${p.nom}`);
    const res = await creerBonDecaissement({ error: null }, fd);
    if (res.error || !res.bonId) return { error: res.error ?? "Échec de création du bon de décaissement." };

    await db.insert(avancesPersonnel).values({
      personnelId,
      montant: montant.toFixed(2),
      date: new Date().toISOString().slice(0, 10),
      auteurId: session.userId,
    });
    revalidatePath("/rh");
    revalidatePath("/tresorerie");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur." };
  }
}

export async function soldeAvance(avanceId: number): Promise<{ error?: string }> {
  await requireRhAccess();
  await db.update(avancesPersonnel).set({ statut: "SOLDEE" }).where(eq(avancesPersonnel.id, avanceId));
  revalidatePath("/rh");
  return {};
}
