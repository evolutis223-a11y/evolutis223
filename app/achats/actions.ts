"use server";

import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { articles, bonsDecaissement, fournisseurs, lotVariantes, lots } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { creerBonDecaissement } from "@/app/tresorerie/actions";

// §7 module Achats — clarifié par l'utilisateur (2026-08-02) : la complexité (fournisseurs,
// articles, lots) est déjà couverte par Fournisseurs+Stock ; ce qui manquait, c'est un écran
// dédié qui la rend visible d'un coup d'œil plutôt qu'éparpillée entre /fournisseurs et /stocks.
// Aucune nouvelle table — vue sur les données existantes + création de bons ACHAT_MARCHANDISE.
async function requireAchatsAccess() {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Achats")) {
    throw new Error("Accès refusé.");
  }
  return session;
}

export async function chargerDonneesAchats() {
  await requireAchatsAccess();

  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);

  const [fournisseurRows, lotRows, bonRows, totalMoisRow] = await Promise.all([
    db.select().from(fournisseurs).orderBy(fournisseurs.nom),
    db
      .select({
        id: lots.id,
        reference: lots.reference,
        dateReception: lots.dateReception,
        prixAchatUnitaire: lots.prixAchatUnitaire,
        articleNom: articles.nom,
        fournisseurNom: fournisseurs.nom,
        quantite: sql<number>`coalesce(sum(${lotVariantes.quantiteProduite}), 0)`,
      })
      .from(lots)
      .innerJoin(articles, eq(articles.id, lots.articleId))
      .leftJoin(fournisseurs, eq(fournisseurs.id, lots.fournisseurId))
      .leftJoin(lotVariantes, eq(lotVariantes.lotId, lots.id))
      .groupBy(lots.id, articles.nom, fournisseurs.nom)
      .orderBy(desc(lots.dateReception))
      .limit(30),
    db
      .select({
        id: bonsDecaissement.id,
        montant: bonsDecaissement.montant,
        motif: bonsDecaissement.motif,
        dateCreation: bonsDecaissement.dateCreation,
        valide: isNotNull(bonsDecaissement.validateurId),
      })
      .from(bonsDecaissement)
      .where(eq(bonsDecaissement.categorie, "ACHAT_MARCHANDISE"))
      .orderBy(desc(bonsDecaissement.dateCreation))
      .limit(30),
    db
      .select({ total: sql<string>`coalesce(sum(${bonsDecaissement.montant}), 0)` })
      .from(bonsDecaissement)
      .where(
        and(
          eq(bonsDecaissement.categorie, "ACHAT_MARCHANDISE"),
          isNotNull(bonsDecaissement.validateurId),
          gte(bonsDecaissement.dateCreation, debutMois)
        )
      ),
  ]);

  return {
    fournisseurs: fournisseurRows,
    lots: lotRows.map((l) => ({ ...l, prixAchatUnitaire: Number(l.prixAchatUnitaire), quantite: Number(l.quantite) })),
    bons: bonRows.map((b) => ({ ...b, montant: Number(b.montant), valide: Boolean(b.valide) })),
    totalAchatsMois: Number(totalMoisRow[0].total),
  };
}

export interface AchatBonState {
  error: string | null;
}

export async function creerBonAchat(_prev: AchatBonState, formData: FormData): Promise<AchatBonState> {
  const montant = String(formData.get("montant") ?? "");
  const motif = String(formData.get("motif") ?? "");
  const fd = new FormData();
  fd.set("categorie", "ACHAT_MARCHANDISE");
  fd.set("montant", montant);
  fd.set("motif", motif);
  const res = await creerBonDecaissement({ error: null }, fd);
  if (!res.error) revalidatePath("/achats");
  return { error: res.error ?? null };
}
