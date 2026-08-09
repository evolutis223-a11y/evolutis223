"use server";

import { and, eq, gte, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  affaires,
  articles,
  besoinsSaisonniers,
  bonsDecaissement,
  bulletinsPaie,
  clients,
  incidentsPersonnel,
  lignesAffaire,
  livraisons,
  personnel,
  utilisateurs,
  variantes,
  vStockVariante,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import type { RapportDocumentData } from "@/lib/documents/types";

async function requireRapportsAccess() {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Rapports")) {
    throw new Error("Accès refusé.");
  }
  return session;
}

export type Frequence = "JOUR" | "SEMAINE" | "MOIS" | "SEMESTRE" | "ANNEE";

function bornesPeriode(frequence: Frequence, reference: Date): { debut: Date; fin: Date } {
  const r = new Date(reference);
  r.setHours(0, 0, 0, 0);

  if (frequence === "JOUR") {
    const fin = new Date(r);
    fin.setDate(fin.getDate() + 1);
    return { debut: r, fin };
  }
  if (frequence === "SEMAINE") {
    const jourSemaine = (r.getDay() + 6) % 7; // 0 = lundi
    const debut = new Date(r);
    debut.setDate(debut.getDate() - jourSemaine);
    const fin = new Date(debut);
    fin.setDate(fin.getDate() + 7);
    return { debut, fin };
  }
  if (frequence === "MOIS") {
    const debut = new Date(r.getFullYear(), r.getMonth(), 1);
    const fin = new Date(r.getFullYear(), r.getMonth() + 1, 1);
    return { debut, fin };
  }
  if (frequence === "SEMESTRE") {
    const semestreDebutMois = r.getMonth() < 6 ? 0 : 6;
    const debut = new Date(r.getFullYear(), semestreDebutMois, 1);
    const fin = new Date(r.getFullYear(), semestreDebutMois + 6, 1);
    return { debut, fin };
  }
  const debut = new Date(r.getFullYear(), 0, 1);
  const fin = new Date(r.getFullYear() + 1, 0, 1);
  return { debut, fin };
}

const LABELS_FREQUENCE: Record<Frequence, string> = {
  JOUR: "Aujourd'hui",
  SEMAINE: "Cette semaine",
  MOIS: "Ce mois",
  SEMESTRE: "Ce semestre",
  ANNEE: "Cette année",
};

// Décale une date de référence de n périodes en arrière — sert à la fois au comparatif
// (n=1 : période précédente) et à la tendance (n=0..5 : plusieurs points dans le temps).
function decalerReference(frequence: Frequence, reference: Date, n: number): Date {
  const r = new Date(reference);
  if (frequence === "JOUR") r.setDate(r.getDate() - n);
  else if (frequence === "SEMAINE") r.setDate(r.getDate() - n * 7);
  else if (frequence === "MOIS") r.setMonth(r.getMonth() - n);
  else if (frequence === "SEMESTRE") r.setMonth(r.getMonth() - n * 6);
  else r.setFullYear(r.getFullYear() - n);
  return r;
}

const MOIS_COURTS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const JOURS_COURTS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function labelPointTendance(frequence: Frequence, debut: Date): string {
  if (frequence === "JOUR") return `${JOURS_COURTS[debut.getDay()]} ${String(debut.getDate()).padStart(2, "0")}`;
  if (frequence === "SEMAINE") return `Sem. ${String(debut.getDate()).padStart(2, "0")}/${String(debut.getMonth() + 1).padStart(2, "0")}`;
  if (frequence === "MOIS") return MOIS_COURTS[debut.getMonth()];
  if (frequence === "SEMESTRE") return `S${debut.getMonth() < 6 ? 1 : 2} ${debut.getFullYear()}`;
  return String(debut.getFullYear());
}

// Variation en % entre deux valeurs — null si la base de comparaison est nulle (rien à comparer,
// pas une variation de 0% ni de +∞%).
function variationPct(actuel: number, precedent: number): number | null {
  if (precedent === 0) return null;
  return Math.round(((actuel - precedent) / Math.abs(precedent)) * 1000) / 10;
}

export interface RapportFinance {
  periodeLabel: string;
  chiffreAffaires: number;
  coutAchatVentes: number;
  beneficeBrut: number;
  depensesCharges: number;
  commissions: number;
  beneficeNet: number;
  nombreVentes: number;
  precedent: { chiffreAffaires: number; beneficeNet: number };
  variationCaPct: number | null;
  variationBeneficeNetPct: number | null;
}

export interface PointTendanceFinance {
  label: string;
  chiffreAffaires: number;
  beneficeNet: number;
}

interface FinanceBrute {
  chiffreAffaires: number;
  coutAchatVentes: number;
  beneficeBrut: number;
  depensesCharges: number;
  commissions: number;
  beneficeNet: number;
  nombreVentes: number;
}

// §7 — "Rapport : Bénéfice brut = CA − coût d'achat des ventes ; bénéfice net = brut −
// dépenses/charges/commissions. Toujours recalculé, jamais saisi à la main." Extrait en fonction
// pure (bornes en paramètre) pour être réutilisée par la période courante, la période précédente
// (comparatif) et chaque point de la tendance — même calcul partout, jamais dupliqué.
//
// Limitation assumée : le coût d'achat des ventes utilise le PMP courant de l'article
// (articles.pmp), pas un PMP historique au moment de la vente — le schéma ne conserve pas de
// PMP figé par ligne d'affaire. Pour un article dont le prix d'achat a beaucoup varié depuis la
// vente, ce chiffre est une approximation, pas un historique exact.
async function calculerFinance(debut: Date, fin: Date): Promise<FinanceBrute> {
  const [venteRow] = await db
    .select({
      ca: sql<string>`coalesce(sum(${affaires.montantTtc}), 0)`,
      nombre: sql<number>`count(*)`,
    })
    .from(affaires)
    .where(
      and(
        inArray(affaires.statut, ["VALIDEE", "CLOTUREE"]),
        gte(affaires.dateCreation, debut),
        lt(affaires.dateCreation, fin)
      )
    );

  const [coutRow] = await db
    .select({ cout: sql<string>`coalesce(sum(${lignesAffaire.quantite} * ${articles.pmp}), 0)` })
    .from(lignesAffaire)
    .innerJoin(affaires, eq(affaires.id, lignesAffaire.affaireId))
    .innerJoin(articles, eq(articles.id, lignesAffaire.articleId))
    .where(
      and(
        inArray(affaires.statut, ["VALIDEE", "CLOTUREE"]),
        gte(affaires.dateCreation, debut),
        lt(affaires.dateCreation, fin)
      )
    );

  const [decaissementRow] = await db
    .select({ total: sql<string>`coalesce(sum(${bonsDecaissement.montant}), 0)` })
    .from(bonsDecaissement)
    .where(
      and(
        inArray(bonsDecaissement.categorie, ["ACHAT_MARCHANDISE", "CHARGE_GENERAL"]),
        isNotNull(bonsDecaissement.validateurId),
        gte(bonsDecaissement.dateCreation, debut),
        lt(bonsDecaissement.dateCreation, fin)
      )
    );

  const [commissionRow] = await db
    .select({ total: sql<string>`coalesce(sum(${bulletinsPaie.commission}), 0)` })
    .from(bulletinsPaie)
    .where(and(eq(bulletinsPaie.statut, "PAYE"), gte(bulletinsPaie.datePaiement, debut), lt(bulletinsPaie.datePaiement, fin)));

  const chiffreAffaires = Number(venteRow.ca);
  const coutAchatVentes = Number(coutRow.cout);
  const depensesCharges = Number(decaissementRow.total);
  const commissions = Number(commissionRow.total);
  const beneficeBrut = chiffreAffaires - coutAchatVentes;
  const beneficeNet = beneficeBrut - depensesCharges - commissions;

  return {
    chiffreAffaires,
    coutAchatVentes,
    beneficeBrut,
    depensesCharges,
    commissions,
    beneficeNet,
    nombreVentes: Number(venteRow.nombre),
  };
}

export async function chargerRapportFinance(frequence: Frequence, reference: Date = new Date()): Promise<RapportFinance> {
  await requireRapportsAccess();
  const { debut, fin } = bornesPeriode(frequence, reference);
  const bornesPrecedentes = bornesPeriode(frequence, decalerReference(frequence, reference, 1));

  const [actuel, precedent] = await Promise.all([
    calculerFinance(debut, fin),
    calculerFinance(bornesPrecedentes.debut, bornesPrecedentes.fin),
  ]);

  return {
    periodeLabel: LABELS_FREQUENCE[frequence],
    ...actuel,
    precedent: { chiffreAffaires: precedent.chiffreAffaires, beneficeNet: precedent.beneficeNet },
    variationCaPct: variationPct(actuel.chiffreAffaires, precedent.chiffreAffaires),
    variationBeneficeNetPct: variationPct(actuel.beneficeNet, precedent.beneficeNet),
  };
}

// Plusieurs points dans le temps (6 par défaut) pour visualiser une tendance, quelle que soit la
// fréquence choisie — ex. en "Mois", les 6 derniers mois ; en "Jour", les 7 derniers jours.
export async function chargerTendanceFinance(frequence: Frequence, nbPoints = 6, reference: Date = new Date()): Promise<PointTendanceFinance[]> {
  await requireRapportsAccess();
  const points: PointTendanceFinance[] = [];
  for (let i = nbPoints - 1; i >= 0; i--) {
    const ref = decalerReference(frequence, reference, i);
    const { debut, fin } = bornesPeriode(frequence, ref);
    const brut = await calculerFinance(debut, fin);
    points.push({ label: labelPointTendance(frequence, debut), chiffreAffaires: brut.chiffreAffaires, beneficeNet: brut.beneficeNet });
  }
  return points;
}

export interface RapportRh {
  periodeLabel: string;
  effectifActif: number;
  masseSalariale: number;
  masseSalarialePrecedente: number;
  variationMassePct: number | null;
  incidents: { type: string; nombre: number }[];
  besoinsActifs: { titre: string; fonction: string | null; nombrePersonnesRequis: number; periodeDebut: string; periodeFin: string; statut: string }[];
}

async function masseSalarialePeriode(debut: Date, fin: Date): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${bulletinsPaie.netAPayer}), 0)` })
    .from(bulletinsPaie)
    .where(and(eq(bulletinsPaie.statut, "PAYE"), gte(bulletinsPaie.datePaiement, debut), lt(bulletinsPaie.datePaiement, fin)));
  return Number(row.total);
}

// §7 — dimensions RH/Incidents/Prévisions, clarifiées par l'utilisateur (2026-08-02) : humaines,
// pas financières. Incidents = maladie/blessure/décès/catastrophe naturelle/blocage de
// recrutement touchant le personnel (`/rh`, onglet Incidents). Prévisions = besoins de personnel
// à venir planifiés par RH (`/rh`, onglet Prévisions) — pas une prévision de chiffre d'affaires.
export async function chargerRapportRh(frequence: Frequence, reference: Date = new Date()): Promise<RapportRh> {
  await requireRapportsAccess();
  const { debut, fin } = bornesPeriode(frequence, reference);
  const bornesPrecedentes = bornesPeriode(frequence, decalerReference(frequence, reference, 1));
  const debutStr = debut.toISOString().slice(0, 10);
  const finStr = fin.toISOString().slice(0, 10);

  const [effectifRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(personnel)
    .where(eq(personnel.actif, true));

  const [masseSalariale, masseSalarialePrecedente] = await Promise.all([
    masseSalarialePeriode(debut, fin),
    masseSalarialePeriode(bornesPrecedentes.debut, bornesPrecedentes.fin),
  ]);

  const incidentRows = await db
    .select({ type: incidentsPersonnel.type, n: sql<number>`count(*)` })
    .from(incidentsPersonnel)
    .where(and(gte(incidentsPersonnel.dateIncident, debutStr), lt(incidentsPersonnel.dateIncident, finStr)))
    .groupBy(incidentsPersonnel.type);

  // "Besoins actifs" = tout besoin dont la période chevauche la fenêtre courante, pas seulement
  // ceux créés dedans — une prévision de personnel se planifie à l'avance, pas rétroactivement.
  const besoinRows = await db
    .select()
    .from(besoinsSaisonniers)
    .where(and(lte(besoinsSaisonniers.periodeDebut, finStr), gte(besoinsSaisonniers.periodeFin, debutStr)));

  return {
    periodeLabel: LABELS_FREQUENCE[frequence],
    effectifActif: Number(effectifRow.n),
    masseSalariale,
    masseSalarialePrecedente,
    variationMassePct: variationPct(masseSalariale, masseSalarialePrecedente),
    incidents: incidentRows.map((r) => ({ type: r.type, nombre: Number(r.n) })),
    besoinsActifs: besoinRows.map((b) => ({
      titre: b.titre,
      fonction: b.fonction,
      nombrePersonnesRequis: b.nombrePersonnesRequis,
      periodeDebut: b.periodeDebut,
      periodeFin: b.periodeFin,
      statut: b.statut,
    })),
  };
}

export interface RapportOperations {
  periodeLabel: string;
  livraisonsParStatut: { statut: string; nombre: number }[];
  totalLivraisons: number;
  ruptureActuelle: number;
  stockFaibleActuel: number;
}

// "Opérations" — livraisons et état du stock, demandés par l'utilisateur (2026-08-09) en plus de
// Finance/RH pour que le rapport couvre "tout, les livraisons, les soucis". Les livraisons sont
// comptées sur leur dateCreation (pas de date de livraison effective distincte en base — voir
// db/schema.ts livraisons) ; rupture/stock faible sont un instantané actuel (état du stock, pas un
// historique sur la période — le manque de couverture historique de vStockVariante ne change pas
// ici).
export async function chargerRapportOperations(frequence: Frequence, reference: Date = new Date()): Promise<RapportOperations> {
  await requireRapportsAccess();
  const { debut, fin } = bornesPeriode(frequence, reference);

  const livraisonRows = await db
    .select({ statut: livraisons.statut, n: sql<number>`count(*)` })
    .from(livraisons)
    .where(and(gte(livraisons.dateCreation, debut), lt(livraisons.dateCreation, fin)))
    .groupBy(livraisons.statut);

  const stockRows = await db
    .select({
      stockDetail: vStockVariante.stockDetail,
      seuilAlerte: variantes.seuilAlerte,
    })
    .from(variantes)
    .leftJoin(vStockVariante, eq(vStockVariante.varianteId, variantes.id));

  let ruptureActuelle = 0;
  let stockFaibleActuel = 0;
  for (const row of stockRows) {
    const stock = row.stockDetail ?? 0;
    if (stock <= 0) ruptureActuelle++;
    else if (stock <= row.seuilAlerte) stockFaibleActuel++;
  }

  const livraisonsParStatut = livraisonRows.map((r) => ({ statut: r.statut, nombre: Number(r.n) }));

  return {
    periodeLabel: LABELS_FREQUENCE[frequence],
    livraisonsParStatut,
    totalLivraisons: livraisonsParStatut.reduce((s, r) => s + r.nombre, 0),
    ruptureActuelle,
    stockFaibleActuel,
  };
}

export interface VenteDetail {
  numero: string;
  clientNom: string;
  montantTtc: number;
  dateCreation: Date;
  statut: string;
}
export interface DecaissementDetail {
  motif: string;
  categorie: string;
  montant: number;
  dateCreation: Date;
  auteurNom: string;
}
export interface LivraisonDetail {
  numero: string;
  affaireNumero: string;
  statut: string;
  dateCreation: Date;
}
export interface RuptureDetail {
  articleNom: string;
  taille: string | null;
  couleur: string | null;
}
export interface IncidentDetail {
  type: string;
  dateIncident: string;
  personnelNom: string;
  description: string | null;
}

export interface RapportDetailComplet {
  periodeLabel: string;
  ventes: VenteDetail[];
  decaissements: DecaissementDetail[];
  livraisons: LivraisonDetail[];
  ruptures: RuptureDetail[];
  incidents: IncidentDetail[];
  besoinsActifs: RapportRh["besoinsActifs"];
}

// Vue "Rapport détaillé" (2026-08-09) : liste ligne par ligne, pas seulement des totaux — pour
// pouvoir vraiment détailler jour/semaine/mois/année comme demandé, sans dupliquer la logique
// d'agrégation ci-dessus (les totaux restent calculés par les fonctions au-dessus).
export async function chargerDetailComplet(frequence: Frequence, reference: Date = new Date()): Promise<RapportDetailComplet> {
  await requireRapportsAccess();
  const { debut, fin } = bornesPeriode(frequence, reference);
  const debutStr = debut.toISOString().slice(0, 10);
  const finStr = fin.toISOString().slice(0, 10);

  const [venteRows, decaissementRows, livraisonRows, incidentRows, besoinRows, stockRows] = await Promise.all([
    db
      .select({
        numero: affaires.numero,
        clientNom: clients.nom,
        montantTtc: affaires.montantTtc,
        dateCreation: affaires.dateCreation,
        statut: affaires.statut,
      })
      .from(affaires)
      .innerJoin(clients, eq(clients.id, affaires.clientId))
      .where(
        and(
          inArray(affaires.statut, ["VALIDEE", "CLOTUREE"]),
          gte(affaires.dateCreation, debut),
          lt(affaires.dateCreation, fin)
        )
      )
      .orderBy(sql`${affaires.dateCreation} desc`)
      .limit(200),
    db
      .select({
        motif: bonsDecaissement.motif,
        categorie: bonsDecaissement.categorie,
        montant: bonsDecaissement.montant,
        dateCreation: bonsDecaissement.dateCreation,
        auteurNom: utilisateurs.nom,
      })
      .from(bonsDecaissement)
      .innerJoin(utilisateurs, eq(utilisateurs.id, bonsDecaissement.auteurId))
      .where(
        and(
          isNotNull(bonsDecaissement.validateurId),
          gte(bonsDecaissement.dateCreation, debut),
          lt(bonsDecaissement.dateCreation, fin)
        )
      )
      .orderBy(sql`${bonsDecaissement.dateCreation} desc`)
      .limit(200),
    db
      .select({
        numero: livraisons.numero,
        affaireNumero: affaires.numero,
        statut: livraisons.statut,
        dateCreation: livraisons.dateCreation,
      })
      .from(livraisons)
      .innerJoin(affaires, eq(affaires.id, livraisons.affaireId))
      .where(and(gte(livraisons.dateCreation, debut), lt(livraisons.dateCreation, fin)))
      .orderBy(sql`${livraisons.dateCreation} desc`)
      .limit(200),
    db
      .select({
        type: incidentsPersonnel.type,
        dateIncident: incidentsPersonnel.dateIncident,
        personnelNom: personnel.nom,
        description: incidentsPersonnel.description,
      })
      .from(incidentsPersonnel)
      .innerJoin(personnel, eq(personnel.id, incidentsPersonnel.personnelId))
      .where(and(gte(incidentsPersonnel.dateIncident, debutStr), lt(incidentsPersonnel.dateIncident, finStr)))
      .orderBy(sql`${incidentsPersonnel.dateIncident} desc`),
    db
      .select()
      .from(besoinsSaisonniers)
      .where(and(lte(besoinsSaisonniers.periodeDebut, finStr), gte(besoinsSaisonniers.periodeFin, debutStr))),
    db
      .select({
        articleNom: articles.nom,
        taille: variantes.taille,
        couleur: variantes.couleur,
        stockDetail: vStockVariante.stockDetail,
      })
      .from(variantes)
      .innerJoin(articles, eq(articles.id, variantes.articleId))
      .leftJoin(vStockVariante, eq(vStockVariante.varianteId, variantes.id)),
  ]);

  return {
    periodeLabel: LABELS_FREQUENCE[frequence],
    ventes: venteRows.map((v) => ({ ...v, montantTtc: Number(v.montantTtc) })),
    decaissements: decaissementRows.map((d) => ({ ...d, montant: Number(d.montant) })),
    livraisons: livraisonRows,
    ruptures: stockRows
      .filter((s) => (s.stockDetail ?? 0) <= 0)
      .map((s) => ({ articleNom: s.articleNom, taille: s.taille, couleur: s.couleur })),
    incidents: incidentRows,
    besoinsActifs: besoinRows.map((b) => ({
      titre: b.titre,
      fonction: b.fonction,
      nombrePersonnesRequis: b.nombrePersonnesRequis,
      periodeDebut: b.periodeDebut,
      periodeFin: b.periodeFin,
      statut: b.statut,
    })),
  };
}

const MOIS_LONGS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// Données du "Rapport officiel" pour un mois donné (annee/mois) — forme unique partagée entre
// l'aperçu HTML (Archive, clic sur un mois) et le générateur PDF (route API "Imprimer"), pour ne
// jamais avoir deux calculs différents du même rapport.
export async function chargerRapportDocumentData(annee: number, mois: number): Promise<RapportDocumentData> {
  await requireRapportsAccess();
  const reference = new Date(annee, mois - 1, 15); // milieu du mois — évite tout effet de bord de fuseau sur le 1er/dernier jour

  const [finance, rh, operations, tendance] = await Promise.all([
    chargerRapportFinance("MOIS", reference),
    chargerRapportRh("MOIS", reference),
    chargerRapportOperations("MOIS", reference),
    chargerTendanceFinance("MOIS", 6, reference),
  ]);

  return {
    periodeLabel: `${MOIS_LONGS[mois - 1]} ${annee}`,
    dateEmission: new Date(),
    finance: {
      chiffreAffaires: finance.chiffreAffaires,
      coutAchatVentes: finance.coutAchatVentes,
      beneficeBrut: finance.beneficeBrut,
      depensesCharges: finance.depensesCharges,
      commissions: finance.commissions,
      beneficeNet: finance.beneficeNet,
      nombreVentes: finance.nombreVentes,
      variationCaPct: finance.variationCaPct,
      variationBeneficeNetPct: finance.variationBeneficeNetPct,
    },
    rh: {
      effectifActif: rh.effectifActif,
      masseSalariale: rh.masseSalariale,
      variationMassePct: rh.variationMassePct,
      incidents: rh.incidents,
      besoinsActifs: rh.besoinsActifs.map((b) => ({
        titre: b.titre,
        nombrePersonnesRequis: b.nombrePersonnesRequis,
        periodeDebut: b.periodeDebut,
        periodeFin: b.periodeFin,
      })),
    },
    operations: {
      totalLivraisons: operations.totalLivraisons,
      livraisonsParStatut: operations.livraisonsParStatut,
      ruptureActuelle: operations.ruptureActuelle,
      stockFaibleActuel: operations.stockFaibleActuel,
    },
    tendance,
  };
}
