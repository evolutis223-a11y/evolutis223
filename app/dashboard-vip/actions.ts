"use server";

import { and, desc, eq, gte, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { affaires, articles, clients, lignesAffaire, parrainageClics, parrainageLiens, utilisateurs } from "@/db/schema";
import { getSession } from "@/lib/auth";

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session || session.roleCode !== "SUPER_ADMIN") throw new Error("Accès refusé.");
  return session;
}

// Même définition que Trésorerie (§ caEtBenefice) — somme des lignes vendues, affaires non
// annulées, pour que "Vente du jour" affiche exactement le même chiffre partout dans l'app.
async function ventesPeriode(debut: Date, fin: Date): Promise<number> {
  const [row] = await db
    .select({ ca: sql<string>`coalesce(sum(${lignesAffaire.quantite} * ${lignesAffaire.prixUnitaire}), 0)` })
    .from(lignesAffaire)
    .innerJoin(affaires, eq(affaires.id, lignesAffaire.affaireId))
    .where(and(ne(affaires.statut, "ANNULEE"), gte(affaires.dateCreation, debut), lt(affaires.dateCreation, fin)));
  return Number(row?.ca ?? 0);
}

function minuit(offsetJours = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetJours);
  return d;
}

export interface VenteRecente {
  id: number;
  numero: string;
  clientNom: string;
  montantTtc: number;
  provenance: string | null;
  dateCreation: Date;
}

export interface PartenaireVip {
  utilisateurId: number;
  nom: string;
  ventesMois: number;
  clicsMois: number;
}

export interface DonneesVip {
  ventesJour: number;
  ventesHier: number;
  ventesSemaine: number;
  ca7Jours: { label: string; valeur: number }[];
  dernieresVentes: VenteRecente[];
  commandesEnLigne: { total: number; enAttente: number };
  partenaires: PartenaireVip[];
}

export async function chargerDonneesVip(): Promise<DonneesVip> {
  const session = await requireSuperAdmin();

  const aujourdhui0h = minuit(0);
  const demain0h = minuit(1);
  const hier0h = minuit(-1);
  const debutSemaine = minuit(-((new Date().getDay() + 6) % 7));

  const jours7: { label: string; valeur: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const debut = minuit(-i);
    const fin = minuit(-i + 1);
    const valeur = await ventesPeriode(debut, fin);
    jours7.push({ label: debut.toLocaleDateString("fr-FR", { weekday: "short" }), valeur });
  }

  const [ventesJour, ventesHier, ventesSemaine, dernieresVentesRows, commandesEnLigneRow, commandesAttenteRow] = await Promise.all([
    ventesPeriode(aujourdhui0h, demain0h),
    ventesPeriode(hier0h, aujourdhui0h),
    ventesPeriode(debutSemaine, demain0h),
    db
      .select({
        id: affaires.id,
        numero: affaires.numero,
        clientNom: clients.nom,
        montantTtc: affaires.montantTtc,
        provenance: affaires.provenance,
        dateCreation: affaires.dateCreation,
      })
      .from(affaires)
      .innerJoin(clients, eq(clients.id, affaires.clientId))
      .where(ne(affaires.statut, "ANNULEE"))
      .orderBy(desc(affaires.dateCreation))
      .limit(8),
    db.select({ total: sql<string>`count(*)` }).from(affaires).where(eq(affaires.provenance, "Boutique en ligne")),
    db
      .select({ total: sql<string>`count(*)` })
      .from(affaires)
      .where(and(eq(affaires.provenance, "Boutique en ligne"), eq(affaires.statut, "EN_ATTENTE"))),
  ]);

  const membres = await db
    .select({ utilisateurId: utilisateurs.id, nom: utilisateurs.nom })
    .from(utilisateurs)
    .innerJoin(parrainageLiens, eq(parrainageLiens.utilisateurId, utilisateurs.id))
    .where(and(eq(parrainageLiens.actif, true), ne(utilisateurs.id, session.userId)));

  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);

  const partenaires: PartenaireVip[] = await Promise.all(
    membres.slice(0, 5).map(async (m) => {
      const [venteRow] = await db
        .select({ total: sql<string>`coalesce(sum(${affaires.montantTtc}), 0)` })
        .from(affaires)
        .where(and(eq(affaires.auteurId, m.utilisateurId), ne(affaires.statut, "ANNULEE"), gte(affaires.dateCreation, debutMois)));
      const [clicRow] = await db
        .select({ total: sql<number>`count(*)` })
        .from(parrainageClics)
        .innerJoin(parrainageLiens, eq(parrainageLiens.id, parrainageClics.lienId))
        .where(and(eq(parrainageLiens.utilisateurId, m.utilisateurId), gte(parrainageClics.dateClic, debutMois)));
      return { utilisateurId: m.utilisateurId, nom: m.nom, ventesMois: Number(venteRow?.total ?? 0), clicsMois: Number(clicRow?.total ?? 0) };
    })
  );
  partenaires.sort((a, b) => b.ventesMois - a.ventesMois);

  return {
    ventesJour,
    ventesHier,
    ventesSemaine,
    ca7Jours: jours7,
    dernieresVentes: dernieresVentesRows.map((v) => ({ ...v, montantTtc: Number(v.montantTtc) })),
    commandesEnLigne: { total: Number(commandesEnLigneRow[0]?.total ?? 0), enAttente: Number(commandesAttenteRow[0]?.total ?? 0) },
    partenaires,
  };
}

// Rafraîchissement léger (sondage périodique côté client) — ne recharge que ce qui change vite,
// évite de refaire les agrégats partenaires/semaine à chaque tick.
export async function rafraichirVenteJour(): Promise<{ ventesJour: number; dernieresVentes: VenteRecente[] }> {
  await requireSuperAdmin();
  const aujourdhui0h = minuit(0);
  const demain0h = minuit(1);
  const [ventesJour, dernieresVentesRows] = await Promise.all([
    ventesPeriode(aujourdhui0h, demain0h),
    db
      .select({
        id: affaires.id,
        numero: affaires.numero,
        clientNom: clients.nom,
        montantTtc: affaires.montantTtc,
        provenance: affaires.provenance,
        dateCreation: affaires.dateCreation,
      })
      .from(affaires)
      .innerJoin(clients, eq(clients.id, affaires.clientId))
      .where(ne(affaires.statut, "ANNULEE"))
      .orderBy(desc(affaires.dateCreation))
      .limit(8),
  ]);
  return { ventesJour, dernieresVentes: dernieresVentesRows.map((v) => ({ ...v, montantTtc: Number(v.montantTtc) })) };
}
