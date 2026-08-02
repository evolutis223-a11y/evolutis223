"use server";

import { and, eq, gte, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  affaires,
  articles,
  besoinsSaisonniers,
  bonsDecaissement,
  bulletinsPaie,
  incidentsPersonnel,
  lignesAffaire,
  personnel,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";

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

export interface RapportFinance {
  periodeLabel: string;
  chiffreAffaires: number;
  coutAchatVentes: number;
  beneficeBrut: number;
  depensesCharges: number;
  commissions: number;
  beneficeNet: number;
  nombreVentes: number;
}

// §7 — "Rapport : Bénéfice brut = CA − coût d'achat des ventes ; bénéfice net = brut −
// dépenses/charges/commissions. Toujours recalculé, jamais saisi à la main." Dimension Finance
// uniquement pour cette passe : RH/Incidents/Prévisions ne sont pas spécifiées dans le cahier des
// charges (quel indicateur exact pour "Incidents" ? quel modèle pour "Prévisions" ?) — non
// construites, à clarifier avant de deviner une forme.
//
// Limitation assumée : le coût d'achat des ventes utilise le PMP courant de l'article
// (articles.pmp), pas un PMP historique au moment de la vente — le schéma ne conserve pas de
// PMP figé par ligne d'affaire. Pour un article dont le prix d'achat a beaucoup varié depuis la
// vente, ce chiffre est une approximation, pas un historique exact.
export async function chargerRapportFinance(frequence: Frequence): Promise<RapportFinance> {
  await requireRapportsAccess();
  const { debut, fin } = bornesPeriode(frequence, new Date());

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
    periodeLabel: LABELS_FREQUENCE[frequence],
    chiffreAffaires,
    coutAchatVentes,
    beneficeBrut,
    depensesCharges,
    commissions,
    beneficeNet,
    nombreVentes: Number(venteRow.nombre),
  };
}

export interface RapportRh {
  periodeLabel: string;
  effectifActif: number;
  masseSalariale: number;
  incidents: { type: string; nombre: number }[];
  besoinsActifs: { titre: string; fonction: string | null; nombrePersonnesRequis: number; periodeDebut: string; periodeFin: string; statut: string }[];
}

// §7 — dimensions RH/Incidents/Prévisions, clarifiées par l'utilisateur (2026-08-02) : humaines,
// pas financières. Incidents = maladie/blessure/décès/catastrophe naturelle/blocage de
// recrutement touchant le personnel (`/rh`, onglet Incidents). Prévisions = besoins de personnel
// à venir planifiés par RH (`/rh`, onglet Prévisions) — pas une prévision de chiffre d'affaires.
export async function chargerRapportRh(frequence: Frequence): Promise<RapportRh> {
  await requireRapportsAccess();
  const { debut, fin } = bornesPeriode(frequence, new Date());
  const debutStr = debut.toISOString().slice(0, 10);
  const finStr = fin.toISOString().slice(0, 10);

  const [effectifRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(personnel)
    .where(eq(personnel.actif, true));

  const [masseRow] = await db
    .select({ total: sql<string>`coalesce(sum(${bulletinsPaie.netAPayer}), 0)` })
    .from(bulletinsPaie)
    .where(and(eq(bulletinsPaie.statut, "PAYE"), gte(bulletinsPaie.datePaiement, debut), lt(bulletinsPaie.datePaiement, fin)));

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
    masseSalariale: Number(masseRow.total),
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
