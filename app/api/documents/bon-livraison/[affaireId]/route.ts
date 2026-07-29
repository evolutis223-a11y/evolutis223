import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { affaires, articles, clients, lignesAffaire, livraisons, variantes } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { generateBonLivraisonPdf, type LigneBonLivraison } from "@/lib/documents";

// Génère et sert le PDF du Bon de livraison à la volée pour une affaire donnée (§13).
// Pas de persistance dans documentsArchives ici — nécessiterait un stockage de fichiers
// tranché (§16, point encore ouvert) ; en attendant, génération + hash à chaque téléchargement.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ affaireId: string }> }
) {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Commandes")) {
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
      statut: affaires.statut,
      modeFinalisation: affaires.modeFinalisation,
      clientNom: clients.nom,
      clientContact: clients.contact,
    })
    .from(affaires)
    .innerJoin(clients, eq(clients.id, affaires.clientId))
    .where(eq(affaires.id, id))
    .limit(1);

  if (!affaire) {
    return NextResponse.json({ error: "Affaire introuvable." }, { status: 404 });
  }
  if (!affaire.modeFinalisation) {
    return NextResponse.json(
      { error: "Cette affaire n'a pas de mode de finalisation (Retrait/Livraison) — pas de bon de livraison à générer." },
      { status: 400 }
    );
  }

  const lignesRows = await db
    .select({
      quantite: lignesAffaire.quantite,
      articleNom: articles.nom,
      taille: variantes.taille,
      couleur: variantes.couleur,
    })
    .from(lignesAffaire)
    .innerJoin(articles, eq(articles.id, lignesAffaire.articleId))
    .leftJoin(variantes, eq(variantes.id, lignesAffaire.varianteId))
    .where(eq(lignesAffaire.affaireId, id));

  const [livraison] = await db
    .select({ statut: livraisons.statut })
    .from(livraisons)
    .where(eq(livraisons.affaireId, id))
    .limit(1);

  // Livré = stock déjà décrémenté (affaire validée) ET, pour le mode Livraison, le livreur a
  // effectivement marqué la course "Livrée" — sinon la marchandise est en transit ou en attente.
  const livre =
    (affaire.statut === "VALIDEE" || affaire.statut === "CLOTUREE") &&
    (affaire.modeFinalisation === "RETRAIT" || livraison?.statut === "LIVREE");

  const lignes: LigneBonLivraison[] = lignesRows.map((l) => ({
    designation: [l.articleNom, l.taille, l.couleur].filter(Boolean).join(" — "),
    quantiteCommandee: l.quantite,
    quantiteLivree: livre ? l.quantite : 0,
  }));

  const { buffer } = await generateBonLivraisonPdf({
    numero: `BL-${affaire.numero}`,
    affaireNumero: affaire.numero,
    objet: `Livraison — commande ${affaire.numero}`,
    clientNom: affaire.clientNom,
    clientContact: affaire.clientContact ?? undefined,
    canal: affaire.modeFinalisation === "RETRAIT" ? "Retrait boutique" : "Livraison",
    lignes,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="BL-${affaire.numero}.pdf"`,
    },
  });
}
