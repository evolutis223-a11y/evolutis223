import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { affaires, articles, clients, lignesAffaire, reglements, variantes } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { generateAffaireDocumentPdf, type LigneAffaireDocument, type TypeDocumentAffaire } from "@/lib/documents";

const TYPES_IMPRIMABLES: TypeDocumentAffaire[] = ["FACTURE", "DEVIS", "PROFORMA", "BON_COMMANDE", "TICKET"];

// Génère et sert le PDF Facture/Devis/Proforma/Bon de commande d'une affaire existante (§13).
// Même limite que le Bon de livraison : pas de persistance dans documentsArchives, génération +
// hash à chaque téléchargement en attendant un stockage de fichiers tranché (§16).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ affaireId: string }> }
) {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Affaires")) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { affaireId } = await params;
  const id = Number(affaireId);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  const [affaire] = await db
    .select({
      id: affaires.id,
      numero: affaires.numero,
      type: affaires.type,
      objet: affaires.objet,
      tvaPct: affaires.tvaPct,
      remiseMontant: affaires.remiseMontant,
      remiseUnite: affaires.remiseUnite,
      montantTtc: affaires.montantTtc,
      infosComplementaires: affaires.infosComplementaires,
      dateCreation: affaires.dateCreation,
      clientNom: clients.nom,
      clientContact: clients.contact,
      clientAdresse: clients.adresse,
    })
    .from(affaires)
    .innerJoin(clients, eq(clients.id, affaires.clientId))
    .where(eq(affaires.id, id))
    .limit(1);

  if (!affaire) {
    return NextResponse.json({ error: "Affaire introuvable." }, { status: 404 });
  }
  if (!TYPES_IMPRIMABLES.includes(affaire.type as TypeDocumentAffaire)) {
    return NextResponse.json(
      { error: `Type d'affaire "${affaire.type}" non imprimable comme Facture/Devis/Proforma/Bon de commande/Reçu.` },
      { status: 400 }
    );
  }

  const [lignesRows, [montantRecuAgg]] = await Promise.all([
    db
      .select({
        quantite: lignesAffaire.quantite,
        prixUnitaire: lignesAffaire.prixUnitaire,
        articleNom: articles.nom,
        taille: variantes.taille,
        couleur: variantes.couleur,
      })
      .from(lignesAffaire)
      .innerJoin(articles, eq(articles.id, lignesAffaire.articleId))
      .leftJoin(variantes, eq(variantes.id, lignesAffaire.varianteId))
      .where(eq(lignesAffaire.affaireId, id)),
    db
      .select({ total: sql<string>`coalesce(sum(${reglements.montant}), 0)` })
      .from(reglements)
      .where(eq(reglements.affaireId, id)),
  ]);

  const lignes: LigneAffaireDocument[] = lignesRows.map((l) => ({
    designation: [l.articleNom, l.taille, l.couleur].filter(Boolean).join(" — "),
    quantite: l.quantite,
    prixUnitaire: Number(l.prixUnitaire),
    total: l.quantite * Number(l.prixUnitaire),
  }));

  const { buffer } = await generateAffaireDocumentPdf({
    docType: affaire.type as TypeDocumentAffaire,
    numero: affaire.numero,
    dateEmission: affaire.dateCreation,
    objet: affaire.objet ?? undefined,
    clientNom: affaire.clientNom,
    clientContact: affaire.clientContact ?? undefined,
    clientAdresse: affaire.clientAdresse ?? undefined,
    lignes,
    tvaPct: affaire.tvaPct ? Number(affaire.tvaPct) : undefined,
    remiseMontant: affaire.remiseMontant ? Number(affaire.remiseMontant) : undefined,
    remiseUnite: (affaire.remiseUnite as "%" | "F" | null) ?? undefined,
    montantTtc: Number(affaire.montantTtc),
    montantRecu: Number(montantRecuAgg.total),
    infosComplementaires: affaire.infosComplementaires ?? undefined,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${affaire.numero}.pdf"`,
    },
  });
}
