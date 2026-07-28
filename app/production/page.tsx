import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { affaires, articles, clients, lignesAffaire, ordresFabrication, utilisateurs } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { listerPilotes } from "./actions";
import { ProductionClient } from "./production-client";

export default async function ProductionPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Production")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès au module Production.</p>
      </main>
    );
  }

  const [ofs, pilotes] = await Promise.all([
    db
      .select({
        id: ordresFabrication.id,
        affaireId: ordresFabrication.affaireId,
        affaireNumero: affaires.numero,
        clientNom: clients.nom,
        articleNom: articles.nom,
        quantite: lignesAffaire.quantite,
        etape: ordresFabrication.etape,
        personnalise: ordresFabrication.personnalise,
        piloteId: ordresFabrication.piloteId,
        piloteNom: utilisateurs.nom,
        dateCreation: ordresFabrication.dateCreation,
      })
      .from(ordresFabrication)
      .innerJoin(affaires, eq(affaires.id, ordresFabrication.affaireId))
      .innerJoin(clients, eq(clients.id, affaires.clientId))
      .innerJoin(lignesAffaire, eq(lignesAffaire.id, ordresFabrication.ligneAffaireId))
      .innerJoin(articles, eq(articles.id, lignesAffaire.articleId))
      .leftJoin(utilisateurs, eq(utilisateurs.id, ordresFabrication.piloteId))
      .orderBy(desc(ordresFabrication.id)),
    listerPilotes(),
  ]);

  return <ProductionClient ofs={ofs} pilotes={pilotes} />;
}
