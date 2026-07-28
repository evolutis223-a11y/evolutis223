import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { affaires, articles, clients, demandesValidationStock, utilisateurs, variantes } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { ValidationsClient } from "./validations-client";

export default async function ValidationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.roleCode)) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">
          Ce module est réservé à Admin/Super Admin (§9).
        </p>
      </main>
    );
  }

  const demandes = await db
    .select({
      id: demandesValidationStock.id,
      affaireId: demandesValidationStock.affaireId,
      affaireNumero: affaires.numero,
      varianteId: demandesValidationStock.varianteId,
      articleNom: articles.nom,
      taille: variantes.taille,
      couleur: variantes.couleur,
      quantiteDemandee: demandesValidationStock.quantiteDemandee,
      manque: demandesValidationStock.manque,
      canal: demandesValidationStock.canal,
      statut: demandesValidationStock.statut,
      quantiteRechargee: demandesValidationStock.quantiteRechargee,
      dateCreation: demandesValidationStock.dateCreation,
      dateTraitement: demandesValidationStock.dateTraitement,
    })
    .from(demandesValidationStock)
    .innerJoin(affaires, eq(affaires.id, demandesValidationStock.affaireId))
    .innerJoin(variantes, eq(variantes.id, demandesValidationStock.varianteId))
    .innerJoin(articles, eq(articles.id, variantes.articleId))
    .orderBy(desc(demandesValidationStock.dateCreation))
    .limit(200);

  const proformas = await db
    .select({
      id: affaires.id,
      numero: affaires.numero,
      statut: affaires.statut,
      montantTtc: affaires.montantTtc,
      clientNom: clients.nom,
      auteurNom: utilisateurs.nom,
      dateCreation: affaires.dateCreation,
    })
    .from(affaires)
    .innerJoin(clients, eq(clients.id, affaires.clientId))
    .innerJoin(utilisateurs, eq(utilisateurs.id, affaires.auteurId))
    .where(eq(affaires.type, "PROFORMA"))
    .orderBy(desc(affaires.id))
    .limit(100);

  return <ValidationsClient demandes={demandes} proformas={proformas} />;
}
