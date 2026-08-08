"use server";

import { and, asc, desc, eq, gte, isNull, lt, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  affaires,
  articles,
  bonsDecaissement,
  chargesFixes,
  cloturesCaisse,
  lignesAffaire,
  objectifsCa,
  parametresTresorerie,
  personnel,
  prets,
  pretsRemboursements,
  reglements,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";

async function requireTresorerieAccess() {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Trésorerie")) {
    throw new Error("Accès refusé.");
  }
  return session;
}

// ---- Décaissements (§7, §16.7) ----

export interface BonState {
  error: string | null;
  bonId?: number;
}

const CATEGORIES = ["ACHAT_MARCHANDISE", "CHARGE_GENERAL", "RH_SALAIRE"] as const;

async function seuilValidation(): Promise<number> {
  const [row] = await db.select().from(parametresTresorerie).limit(1);
  return row ? Number(row.seuilValidationDecaissement) : 50000;
}

export async function creerBonDecaissement(_prevState: BonState, formData: FormData): Promise<BonState> {
  const session = await requireTresorerieAccess();
  const categorie = String(formData.get("categorie") ?? "");
  const montant = Number(formData.get("montant"));
  const motif = String(formData.get("motif") ?? "").trim();
  const chargeFixeIdRaw = formData.get("chargeFixeId");
  const chargeFixeId = chargeFixeIdRaw ? Number(chargeFixeIdRaw) : null;

  if (!CATEGORIES.includes(categorie as (typeof CATEGORIES)[number])) {
    return { error: "Catégorie invalide." };
  }
  if (!Number.isFinite(montant) || montant <= 0) return { error: "Montant invalide." };
  if (!motif) return { error: "Motif requis." };

  const seuil = await seuilValidation();
  const autoValide = montant <= seuil;

  const [bon] = await db
    .insert(bonsDecaissement)
    .values({
      categorie,
      montant: montant.toFixed(2),
      motif,
      chargeFixeId: categorie === "CHARGE_GENERAL" ? chargeFixeId : null,
      auteurId: session.userId,
      validateurId: autoValide ? session.userId : null,
    })
    .returning();

  revalidatePath("/tresorerie");
  return { error: null, bonId: bon.id };
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

// ---- Solde de caisse / clôtures ----

function debutFin(date: Date) {
  const debut = new Date(date);
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 1);
  return { debut, fin };
}

function debutSemaine(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const jour = d.getDay(); // 0=dimanche..6=samedi
  const decalage = jour === 0 ? -6 : 1 - jour;
  d.setDate(d.getDate() + decalage);
  return d;
}

function debutMois(date: Date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
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
    .where(
      and(
        sql`${bonsDecaissement.validateurId} is not null`,
        gte(bonsDecaissement.dateCreation, debut),
        lt(bonsDecaissement.dateCreation, fin)
      )
    );

  return Number(encaisse.total) - Number(decaisse.total);
}

export interface ClotureState {
  error: string | null;
}

export async function cloturerCaisse(_prevState: ClotureState, formData: FormData): Promise<ClotureState> {
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

// ---- CA / bénéfice (basé sur le PMP par ligne vendue, cohérent avec le Tableau de bord) ----

async function caEtBenefice(debut: Date, fin: Date) {
  const [ligneRow] = await db
    .select({
      ca: sql<string>`coalesce(sum(${lignesAffaire.quantite} * ${lignesAffaire.prixUnitaire}), 0)`,
      cout: sql<string>`coalesce(sum(${lignesAffaire.quantite} * ${articles.pmp}), 0)`,
    })
    .from(lignesAffaire)
    .innerJoin(affaires, eq(affaires.id, lignesAffaire.affaireId))
    .innerJoin(articles, eq(articles.id, lignesAffaire.articleId))
    .where(and(ne(affaires.statut, "ANNULEE"), gte(affaires.dateCreation, debut), lt(affaires.dateCreation, fin)));

  const [decaisseRow] = await db
    .select({ total: sql<string>`coalesce(sum(${bonsDecaissement.montant}), 0)` })
    .from(bonsDecaissement)
    .where(
      and(
        sql`${bonsDecaissement.categorie} in ('CHARGE_GENERAL','RH_SALAIRE')`,
        sql`${bonsDecaissement.validateurId} is not null`,
        gte(bonsDecaissement.dateCreation, debut),
        lt(bonsDecaissement.dateCreation, fin)
      )
    );

  const ca = Number(ligneRow.ca);
  const coutMatiere = Number(ligneRow.cout);
  const beneficeBrut = ca - coutMatiere;
  const chargesEtSalaires = Number(decaisseRow.total);
  const beneficeNet = beneficeBrut - chargesEtSalaires;

  return { ca, coutMatiere, beneficeBrut, beneficeNet };
}

// ---- Vue d'ensemble : chargement complet ----

export async function chargerDonneesTresorerie() {
  await requireTresorerieAccess();

  const maintenant = new Date();
  const { debut: debutJour, fin: finJour } = debutFin(maintenant);
  const debutSem = debutSemaine(maintenant);
  const debutM = debutMois(maintenant);

  const [
    bons,
    clotures,
    parametres,
    soldeTheoriqueAujourdhui,
    chargesFixesRows,
    objectifsRows,
    pretsRows,
    remboursementsRows,
    compteAttenteRows,
    caJour,
    caSemaine,
    caMois,
    masseSalarialeRow,
    repartitionMoisRows,
  ] = await Promise.all([
    db.select().from(bonsDecaissement).orderBy(desc(bonsDecaissement.id)).limit(80),
    db.select().from(cloturesCaisse).orderBy(desc(cloturesCaisse.dateCloture)).limit(30),
    db.select().from(parametresTresorerie).limit(1),
    calculerSoldeTheorique(maintenant),
    db.select().from(chargesFixes).where(eq(chargesFixes.actif, true)).orderBy(asc(chargesFixes.id)),
    db.select().from(objectifsCa),
    db.select().from(prets).orderBy(desc(prets.id)),
    db.select().from(pretsRemboursements).orderBy(desc(pretsRemboursements.id)),
    db
      .select()
      .from(reglements)
      .where(isNull(reglements.affaireId))
      .orderBy(desc(reglements.dateReglement))
      .limit(20),
    caEtBenefice(debutJour, finJour),
    caEtBenefice(debutSem, finJour),
    caEtBenefice(debutM, finJour),
    db
      .select({
        masseSalariale: sql<string>`coalesce(sum(${personnel.salaireBase}), 0)`,
        nbActifs: sql<number>`count(*)`,
      })
      .from(personnel)
      .where(eq(personnel.actif, true)),
    db
      .select({
        categorie: bonsDecaissement.categorie,
        chargeFixeId: bonsDecaissement.chargeFixeId,
        total: sql<string>`coalesce(sum(${bonsDecaissement.montant}), 0)`,
      })
      .from(bonsDecaissement)
      .where(
        and(
          sql`${bonsDecaissement.validateurId} is not null`,
          gte(bonsDecaissement.dateCreation, debutM),
          lt(bonsDecaissement.dateCreation, finJour)
        )
      )
      .groupBy(bonsDecaissement.categorie, bonsDecaissement.chargeFixeId),
  ]);

  const remboursementsParPret = new Map<number, number>();
  for (const r of remboursementsRows) {
    remboursementsParPret.set(r.pretId, (remboursementsParPret.get(r.pretId) ?? 0) + Number(r.montant));
  }

  const totalParCategorie = { ACHAT_MARCHANDISE: 0, CHARGE_GENERAL: 0, RH_SALAIRE: 0 } as Record<string, number>;
  const totalParChargeFixe = new Map<number, number>();
  for (const r of repartitionMoisRows) {
    totalParCategorie[r.categorie] = (totalParCategorie[r.categorie] ?? 0) + Number(r.total);
    if (r.categorie === "CHARGE_GENERAL" && r.chargeFixeId != null) {
      totalParChargeFixe.set(r.chargeFixeId, (totalParChargeFixe.get(r.chargeFixeId) ?? 0) + Number(r.total));
    }
  }

  const budgetMensuelEstime = chargesFixesRows.reduce((acc, c) => acc + Number(c.montantEstime), 0) + Number(masseSalarialeRow[0].masseSalariale);

  const objectifsParPeriode = new Map(objectifsRows.map((o) => [o.periode, Number(o.montant)]));

  return {
    bons: bons.map((b) => ({ ...b, montant: Number(b.montant), valide: Boolean(b.validateurId) })),
    clotures: clotures.map((c) => ({ ...c, soldeTheorique: Number(c.soldeTheorique), comptageReel: Number(c.comptageReel), ecart: Number(c.ecart) })),
    seuilValidation: parametres[0] ? Number(parametres[0].seuilValidationDecaissement) : 50000,
    soldeTheoriqueAujourdhui,
    chargesFixes: chargesFixesRows.map((c) => ({
      ...c,
      montantEstime: Number(c.montantEstime),
      montantReelMois: totalParChargeFixe.get(c.id) ?? 0,
    })),
    budgetMensuelEstime,
    objectifs: {
      JOUR: objectifsParPeriode.get("JOUR") ?? 0,
      SEMAINE: objectifsParPeriode.get("SEMAINE") ?? 0,
      MOIS: objectifsParPeriode.get("MOIS") ?? 0,
    },
    prets: pretsRows.map((p) => {
      const rembourse = remboursementsParPret.get(p.id) ?? 0;
      return { ...p, montant: Number(p.montant), montantRembourse: rembourse, montantRestant: Math.max(0, Number(p.montant) - rembourse) };
    }),
    compteAttente: compteAttenteRows.map((r) => ({ ...r, montant: Number(r.montant) })),
    ca: { jour: caJour, semaine: caSemaine, mois: caMois },
    rh: {
      masseSalariale: Number(masseSalarialeRow[0].masseSalariale),
      nbActifs: Number(masseSalarialeRow[0].nbActifs),
      payeCeMois: totalParCategorie.RH_SALAIRE,
    },
    repartitionMois: totalParCategorie,
    decaisseMoisValide: totalParCategorie.ACHAT_MARCHANDISE + totalParCategorie.CHARGE_GENERAL + totalParCategorie.RH_SALAIRE,
    nbEnAttenteValidation: bons.filter((b) => !b.validateurId).length,
  };
}

// ---- Charges fixes (Objectifs & Prévisions) ----

export async function ajouterChargeFixe(nom: string, montantEstime: number): Promise<{ error?: string }> {
  const session = await requireTresorerieAccess();
  if (!nom.trim()) return { error: "Nom requis." };
  if (!Number.isFinite(montantEstime) || montantEstime < 0) return { error: "Montant invalide." };
  await db.insert(chargesFixes).values({ nom: nom.trim(), montantEstime: montantEstime.toFixed(2), creePar: session.userId });
  revalidatePath("/tresorerie");
  return {};
}

export async function modifierChargeFixe(id: number, montantEstime: number): Promise<{ error?: string }> {
  await requireTresorerieAccess();
  if (!Number.isFinite(montantEstime) || montantEstime < 0) return { error: "Montant invalide." };
  await db.update(chargesFixes).set({ montantEstime: montantEstime.toFixed(2) }).where(eq(chargesFixes.id, id));
  revalidatePath("/tresorerie");
  return {};
}

export async function supprimerChargeFixe(id: number): Promise<{ error?: string }> {
  await requireTresorerieAccess();
  await db.update(chargesFixes).set({ actif: false }).where(eq(chargesFixes.id, id));
  revalidatePath("/tresorerie");
  return {};
}

// ---- Objectifs de chiffre d'affaires ----

export async function definirObjectifCa(periode: "JOUR" | "SEMAINE" | "MOIS", montant: number): Promise<{ error?: string }> {
  const session = await requireTresorerieAccess();
  if (!Number.isFinite(montant) || montant < 0) return { error: "Montant invalide." };

  const [existing] = await db.select().from(objectifsCa).where(eq(objectifsCa.periode, periode)).limit(1);
  if (existing) {
    await db
      .update(objectifsCa)
      .set({ montant: montant.toFixed(2), modifiePar: session.userId, dateModification: new Date() })
      .where(eq(objectifsCa.id, existing.id));
  } else {
    await db.insert(objectifsCa).values({ periode, montant: montant.toFixed(2), modifiePar: session.userId });
  }
  revalidatePath("/tresorerie");
  return {};
}

// ---- Prêts ----

export async function creerPret(input: {
  type: "BANCAIRE" | "PERSONNEL" | "PROPRIETAIRE";
  preteurNom: string;
  montant: number;
  dateObtention: string;
  dateEcheance: string | null;
}): Promise<{ error?: string }> {
  const session = await requireTresorerieAccess();
  if (!input.preteurNom.trim()) return { error: "Nom du prêteur requis." };
  if (!Number.isFinite(input.montant) || input.montant <= 0) return { error: "Montant invalide." };
  if (!input.dateObtention) return { error: "Date d'obtention requise." };

  await db.insert(prets).values({
    type: input.type,
    preteurNom: input.preteurNom.trim(),
    montant: input.montant.toFixed(2),
    dateObtention: input.dateObtention,
    dateEcheance: input.dateEcheance || null,
    creePar: session.userId,
  });
  revalidatePath("/tresorerie");
  return {};
}

export async function rembourserPret(pretId: number, montant: number): Promise<{ error?: string }> {
  const session = await requireTresorerieAccess();
  if (!Number.isFinite(montant) || montant <= 0) return { error: "Montant invalide." };

  const [pret] = await db.select().from(prets).where(eq(prets.id, pretId)).limit(1);
  if (!pret) return { error: "Prêt introuvable." };

  await db.transaction(async (tx) => {
    await tx.insert(pretsRemboursements).values({ pretId, montant: montant.toFixed(2), auteurId: session.userId });

    const [sommeRow] = await tx
      .select({ total: sql<string>`coalesce(sum(${pretsRemboursements.montant}), 0)` })
      .from(pretsRemboursements)
      .where(eq(pretsRemboursements.pretId, pretId));
    const totalRembourse = Number(sommeRow.total);

    if (totalRembourse >= Number(pret.montant)) {
      await tx.update(prets).set({ statut: "REMBOURSE" }).where(eq(prets.id, pretId));
    }
  });

  revalidatePath("/tresorerie");
  return {};
}

// ---- Compte d'attente (paiements reçus non rattachés à une affaire, tous modes confondus) ----

export async function rattacherReglementAffaire(reglementId: number, affaireId: number): Promise<{ error?: string }> {
  await requireTresorerieAccess();
  const [affaire] = await db.select({ id: affaires.id }).from(affaires).where(eq(affaires.id, affaireId)).limit(1);
  if (!affaire) return { error: "Affaire introuvable." };

  await db.update(reglements).set({ affaireId }).where(eq(reglements.id, reglementId));
  revalidatePath("/tresorerie");
  revalidatePath("/affaires");
  return {};
}
