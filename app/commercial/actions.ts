"use server";

import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { affaires, bulletinsPaie, clients, lignesAffaire, parrainageLiens, personnel, roles, utilisateurs } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { genererNumero } from "../affaires/actions";
import type { LigneInput } from "../affaires/actions";

async function requireCommercialAccess() {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Commercial")) {
    throw new Error("Accès refusé.");
  }
  return session;
}

// §12 : les partenaires (Freelance, Commercial à distance) remplissent une proforma
// (fonctionnellement un Devis) qui part en validation Admin/Super Admin avant envoi au client —
// même logique de file d'attente que §9, mais sur affaires.statut plutôt que sur une table dédiée.
export async function creerProforma(
  clientNom: string,
  clientContact: string,
  lignes: LigneInput[]
): Promise<{ affaireId?: number; error?: string }> {
  try {
    const session = await requireCommercialAccess();
    const nom = clientNom.trim();
    const contact = clientContact.trim() || null;
    if (!nom) return { error: "Nom du client requis." };
    if (lignes.length === 0) return { error: "Au moins une ligne requise." };
    if (lignes.some((l) => !l.articleId || l.quantite <= 0)) {
      return { error: "Chaque ligne doit avoir un article et une quantité valide." };
    }

    const montantTtc = lignes.reduce((acc, l) => acc + l.quantite * l.prixUnitaire, 0);
    const numero = await genererNumero("PRO");

    const affaireId = await db.transaction(async (tx) => {
      let clientId: number;
      const existing = contact ? await tx.select().from(clients).where(eq(clients.contact, contact)).limit(1) : [];
      if (existing.length > 0) {
        clientId = existing[0].id;
      } else {
        const [created] = await tx.insert(clients).values({ typeClient: "BOUTIQUE", nom, contact }).returning();
        clientId = created.id;
      }

      const [affaire] = await tx
        .insert(affaires)
        .values({
          numero,
          type: "PROFORMA",
          statut: "EN_ATTENTE",
          clientId,
          montantTtc: montantTtc.toFixed(2),
          auteurId: session.userId,
        })
        .returning();

      for (const l of lignes) {
        await tx.insert(lignesAffaire).values({
          affaireId: affaire.id,
          articleId: l.articleId,
          varianteId: l.varianteId,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire.toFixed(2),
        });
      }

      return affaire.id;
    });

    revalidatePath("/commercial");
    revalidatePath("/validations");
    return { affaireId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

function genererCodeParrainage(nom: string): string {
  const base = nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10)
    .toUpperCase();
  const suffixe = randomBytes(2).toString("hex").toUpperCase();
  return `${base || "PARTENAIRE"}${suffixe}`;
}

// Fourni le lien de parrainage de l'utilisateur courant, le crée à la première visite —
// prépare le terrain pour la boutique en ligne (§ marketing d'affiliation, 2026-08-08) : le clic
// et la conversion ne seront réellement suivis qu'une fois la boutique construite.
export async function obtenirMonLienParrainage(): Promise<{ code: string }> {
  const session = await requireCommercialAccess();

  const [existant] = await db.select().from(parrainageLiens).where(eq(parrainageLiens.utilisateurId, session.userId)).limit(1);
  if (existant) return { code: existant.code };

  const [user] = await db.select({ nom: utilisateurs.nom }).from(utilisateurs).where(eq(utilisateurs.id, session.userId)).limit(1);
  const code = genererCodeParrainage(user?.nom ?? "PARTENAIRE");

  const [cree] = await db.insert(parrainageLiens).values({ utilisateurId: session.userId, code }).returning();
  return { code: cree.code };
}

function bornesMoisCourant() {
  const debut = new Date();
  debut.setDate(1);
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(debut);
  fin.setMonth(fin.getMonth() + 1);
  return { debut, fin };
}

async function ventesEtCommission(utilisateurId: number, tauxCommission: number | null, debut: Date, fin: Date) {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${affaires.montantTtc}), 0)`,
      nombre: sql<number>`count(*)`,
    })
    .from(affaires)
    .where(and(eq(affaires.auteurId, utilisateurId), gte(affaires.dateCreation, debut), lt(affaires.dateCreation, fin), sql`${affaires.statut} != 'ANNULEE'`));

  const ventes = Number(row.total);
  const nombre = Number(row.nombre);
  const commission = tauxCommission ? ventes * (tauxCommission / 100) : 0;
  return { ventes, nombre, commission };
}

export interface DonneesCommerciales {
  moi: {
    lienCode: string;
    tauxCommission: number | null;
    ventesMois: number;
    nombreVentesMois: number;
    commissionSuggereeMois: number;
    commissionPayeeTotal: number;
    commissionEnAttente: number;
    aUnPersonnelLie: boolean;
  };
  equipe: {
    utilisateurId: number;
    nom: string;
    roleLibelle: string;
    tauxCommission: number | null;
    ventesMois: number;
    nombreVentesMois: number;
    commissionSuggereeMois: number;
  }[];
  proformas: {
    id: number;
    numero: string;
    statut: string;
    montantTtc: string;
    clientNom: string;
    dateCreation: Date;
  }[];
}

export async function chargerDonneesCommerciales(): Promise<DonneesCommerciales> {
  const session = await requireCommercialAccess();
  const { debut, fin } = bornesMoisCourant();

  const [{ code: lienCode }, monPersonnel, mesProformas] = await Promise.all([
    obtenirMonLienParrainage(),
    db.select().from(personnel).where(eq(personnel.utilisateurId, session.userId)).limit(1),
    db
      .select({
        id: affaires.id,
        numero: affaires.numero,
        statut: affaires.statut,
        montantTtc: affaires.montantTtc,
        clientNom: clients.nom,
        dateCreation: affaires.dateCreation,
      })
      .from(affaires)
      .innerJoin(clients, eq(clients.id, affaires.clientId))
      .where(and(eq(affaires.type, "PROFORMA"), eq(affaires.auteurId, session.userId)))
      .orderBy(desc(affaires.id)),
  ]);

  const p = monPersonnel[0];
  const tauxCommission = p?.tauxCommission != null ? Number(p.tauxCommission) : null;
  const { ventes, nombre, commission } = await ventesEtCommission(session.userId, tauxCommission, debut, fin);

  let commissionPayeeTotal = 0;
  let commissionEnAttente = 0;
  if (p) {
    const bulletins = await db.select().from(bulletinsPaie).where(eq(bulletinsPaie.personnelId, p.id));
    for (const b of bulletins) {
      if (b.statut === "PAYE") commissionPayeeTotal += Number(b.commission);
      else commissionEnAttente += Number(b.commission);
    }
  }

  let equipe: DonneesCommerciales["equipe"] = [];
  if (session.roleCode === "RESP_COMMERCIAL") {
    const membres = await db
      .select({
        utilisateurId: utilisateurs.id,
        nom: utilisateurs.nom,
        roleLibelle: roles.libelle,
        tauxCommission: personnel.tauxCommission,
      })
      .from(utilisateurs)
      .innerJoin(roles, eq(roles.id, utilisateurs.roleId))
      .leftJoin(personnel, eq(personnel.utilisateurId, utilisateurs.id))
      .where(inArray(roles.code, ["FREELANCE", "COMMERCIAL"]));

    equipe = await Promise.all(
      membres.map(async (m) => {
        const taux = m.tauxCommission != null ? Number(m.tauxCommission) : null;
        const r = await ventesEtCommission(m.utilisateurId, taux, debut, fin);
        return {
          utilisateurId: m.utilisateurId,
          nom: m.nom,
          roleLibelle: m.roleLibelle,
          tauxCommission: taux,
          ventesMois: r.ventes,
          nombreVentesMois: r.nombre,
          commissionSuggereeMois: r.commission,
        };
      })
    );
  }

  return {
    moi: {
      lienCode,
      tauxCommission,
      ventesMois: ventes,
      nombreVentesMois: nombre,
      commissionSuggereeMois: commission,
      commissionPayeeTotal,
      commissionEnAttente,
      aUnPersonnelLie: Boolean(p),
    },
    equipe,
    proformas: mesProformas,
  };
}
