"use server";

import { desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { affaires, articles, clients, lignesAffaire, livraisons, parametresDocuments, reglements, utilisateurs, variantes } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { MENTIONS_LEGALES_TEXTE } from "@/lib/documents/legal-mentions";
import type { DocumentPreviewData } from "@/components/documents/document-preview";

async function requireParametresAccess() {
  const session = await getSession();
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.roleCode)) {
    throw new Error("Accès refusé.");
  }
  return session;
}

export async function chargerMastheadTexte(): Promise<string> {
  const [row] = await db
    .select({ config: parametresDocuments.config })
    .from(parametresDocuments)
    .where(eq(parametresDocuments.typeDocument, "MASTHEAD_GLOBAL"))
    .limit(1);
  const texte = (row?.config as { texte?: string } | undefined)?.texte;
  return texte || MENTIONS_LEGALES_TEXTE;
}

export async function enregistrerMastheadTexte(texte: string): Promise<{ error?: string }> {
  try {
    const session = await requireParametresAccess();
    const [existing] = await db
      .select({ id: parametresDocuments.id })
      .from(parametresDocuments)
      .where(eq(parametresDocuments.typeDocument, "MASTHEAD_GLOBAL"))
      .limit(1);
    if (existing) {
      await db
        .update(parametresDocuments)
        .set({ config: { texte }, modifiePar: session.userId, dateModification: new Date() })
        .where(eq(parametresDocuments.id, existing.id));
    } else {
      await db.insert(parametresDocuments).values({ typeDocument: "MASTHEAD_GLOBAL", config: { texte }, modifiePar: session.userId });
    }
    revalidatePath("/parametres");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur." };
  }
}

export type ExempleDocument = DocumentPreviewData;

async function chargerExemple(type: string): Promise<ExempleDocument | null> {
  const [affaire] = await db
    .select({
      id: affaires.id,
      numero: affaires.numero,
      dateCreation: affaires.dateCreation,
      immuable: affaires.immuable,
      provenance: affaires.provenance,
      objet: affaires.objet,
      tvaPct: affaires.tvaPct,
      remiseMontant: affaires.remiseMontant,
      remiseUnite: affaires.remiseUnite,
      montantTtc: affaires.montantTtc,
      modeFinalisation: affaires.modeFinalisation,
      infosComplementaires: affaires.infosComplementaires,
      mentionValidite: affaires.mentionValidite,
      acomptePct: affaires.acomptePct,
      clientNom: clients.nom,
      clientAdresse: clients.adresse,
      clientTelephone: clients.contact,
      commercialNom: utilisateurs.nom,
    })
    .from(affaires)
    .innerJoin(clients, eq(clients.id, affaires.clientId))
    .innerJoin(utilisateurs, eq(utilisateurs.id, affaires.auteurId))
    .where(eq(affaires.type, type))
    .orderBy(desc(affaires.id))
    .limit(1);
  if (!affaire) return null;

  const [ligneRows, [livraison], [montantRegleAgg]] = await Promise.all([
    db
      .select({ nom: articles.nom, qte: lignesAffaire.quantite, pu: lignesAffaire.prixUnitaire, taille: variantes.taille, couleur: variantes.couleur })
      .from(lignesAffaire)
      .innerJoin(articles, eq(articles.id, lignesAffaire.articleId))
      .leftJoin(variantes, eq(variantes.id, lignesAffaire.varianteId))
      .where(eq(lignesAffaire.affaireId, affaire.id)),
    db.select({ adresse: livraisons.adresse }).from(livraisons).where(eq(livraisons.affaireId, affaire.id)).limit(1),
    db.select({ total: sql<string>`coalesce(sum(${reglements.montant}), 0)` }).from(reglements).where(eq(reglements.affaireId, affaire.id)),
  ]);

  return {
    type,
    numero: affaire.numero,
    dateCreation: affaire.dateCreation,
    immuable: affaire.immuable,
    provenance: affaire.provenance,
    objet: affaire.objet,
    clientNom: affaire.clientNom,
    clientAdresse: affaire.clientAdresse,
    clientTelephone: affaire.clientTelephone,
    commercialNom: affaire.commercialNom,
    modeFinalisation: affaire.modeFinalisation,
    adresseLivraison: livraison?.adresse ?? null,
    tvaPct: affaire.tvaPct ? Number(affaire.tvaPct) : null,
    remiseMontant: affaire.remiseMontant ? Number(affaire.remiseMontant) : null,
    remiseUnite: affaire.remiseUnite,
    montantTtc: Number(affaire.montantTtc),
    montantRegle: Number(montantRegleAgg.total),
    infosComplementaires: affaire.infosComplementaires,
    mentionValidite: affaire.mentionValidite,
    acomptePct: affaire.acomptePct ? Number(affaire.acomptePct) : null,
    lignes: ligneRows.map((l) => ({ nom: [l.nom, l.taille, l.couleur].filter(Boolean).join(" — "), qte: l.qte, pu: Number(l.pu) })),
  };
}

// La maquette traite "Bon de livraison" comme un type d'affaire à part entière (avec ses propres
// lignes quantité commandée/livrée). Chez nous, une livraison est un enregistrement `livraisons`
// rattaché à une affaire réelle (§8.1) — pas un type de document séparé. On adapte : l'exemple BL
// vient de la livraison la plus récente, avec les lignes de l'affaire qu'elle documente.
async function chargerExempleLivraison(): Promise<ExempleDocument | null> {
  const [livraison] = await db
    .select({
      affaireId: livraisons.affaireId,
      adresse: livraisons.adresse,
      numero: livraisons.numero,
      dateCreation: livraisons.dateCreation,
    })
    .from(livraisons)
    .orderBy(desc(livraisons.id))
    .limit(1);
  if (!livraison) return null;

  const [affaire] = await db
    .select({
      numero: affaires.numero,
      dateCreation: affaires.dateCreation,
      immuable: affaires.immuable,
      provenance: affaires.provenance,
      objet: affaires.objet,
      tvaPct: affaires.tvaPct,
      remiseMontant: affaires.remiseMontant,
      remiseUnite: affaires.remiseUnite,
      montantTtc: affaires.montantTtc,
      modeFinalisation: affaires.modeFinalisation,
      infosComplementaires: affaires.infosComplementaires,
      mentionValidite: affaires.mentionValidite,
      acomptePct: affaires.acomptePct,
      clientNom: clients.nom,
      clientAdresse: clients.adresse,
      clientTelephone: clients.contact,
      commercialNom: utilisateurs.nom,
    })
    .from(affaires)
    .innerJoin(clients, eq(clients.id, affaires.clientId))
    .innerJoin(utilisateurs, eq(utilisateurs.id, affaires.auteurId))
    .where(eq(affaires.id, livraison.affaireId))
    .limit(1);
  if (!affaire) return null;

  const [ligneRows, [montantRegleAgg]] = await Promise.all([
    db
      .select({ nom: articles.nom, qte: lignesAffaire.quantite, pu: lignesAffaire.prixUnitaire, taille: variantes.taille, couleur: variantes.couleur })
      .from(lignesAffaire)
      .innerJoin(articles, eq(articles.id, lignesAffaire.articleId))
      .leftJoin(variantes, eq(variantes.id, lignesAffaire.varianteId))
      .where(eq(lignesAffaire.affaireId, livraison.affaireId)),
    db.select({ total: sql<string>`coalesce(sum(${reglements.montant}), 0)` }).from(reglements).where(eq(reglements.affaireId, livraison.affaireId)),
  ]);

  return {
    type: "BON_LIVRAISON",
    numero: livraison.numero,
    dateCreation: livraison.dateCreation,
    immuable: affaire.immuable,
    provenance: affaire.provenance,
    objet: affaire.objet,
    clientNom: affaire.clientNom,
    clientAdresse: affaire.clientAdresse,
    clientTelephone: affaire.clientTelephone,
    commercialNom: affaire.commercialNom,
    modeFinalisation: affaire.modeFinalisation,
    adresseLivraison: livraison.adresse,
    tvaPct: affaire.tvaPct ? Number(affaire.tvaPct) : null,
    remiseMontant: affaire.remiseMontant ? Number(affaire.remiseMontant) : null,
    remiseUnite: affaire.remiseUnite,
    montantTtc: Number(affaire.montantTtc),
    montantRegle: Number(montantRegleAgg.total),
    infosComplementaires: affaire.infosComplementaires,
    mentionValidite: affaire.mentionValidite,
    acomptePct: affaire.acomptePct ? Number(affaire.acomptePct) : null,
    lignes: ligneRows.map((l) => ({ nom: [l.nom, l.taille, l.couleur].filter(Boolean).join(" — "), qte: l.qte, pu: Number(l.pu) })),
  };
}

export async function chargerModelesData() {
  const [masthead, facture, devis, proforma, bc, bl] = await Promise.all([
    chargerMastheadTexte(),
    chargerExemple("FACTURE"),
    chargerExemple("DEVIS"),
    chargerExemple("PROFORMA"),
    chargerExemple("BON_COMMANDE"),
    chargerExempleLivraison(),
  ]);
  return { masthead, exemples: { facture, devis, proforma, bc, bl } };
}
