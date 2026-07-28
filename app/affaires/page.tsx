import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  affaires,
  articles,
  clients,
  demandesValidationStock,
  lignesAffaire,
  reglements,
  variantes,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { AffairesClient } from "./affaires-client";

export default async function AffairesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Affaires")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès au module Affaires.</p>
      </main>
    );
  }

  const [clientRows, articleRows, varianteRows, affaireRows, ligneRows, reglementRows, demandeRows] =
    await Promise.all([
      db.select().from(clients).orderBy(clients.nom),
      db.select().from(articles).orderBy(articles.nom),
      db.select().from(variantes),
      db
        .select({
          id: affaires.id,
          numero: affaires.numero,
          type: affaires.type,
          statut: affaires.statut,
          montantTtc: affaires.montantTtc,
          immuable: affaires.immuable,
          dateCreation: affaires.dateCreation,
          clientNom: clients.nom,
          clientId: affaires.clientId,
        })
        .from(affaires)
        .innerJoin(clients, eq(clients.id, affaires.clientId))
        .orderBy(desc(affaires.id)),
      db.select().from(lignesAffaire),
      db.select().from(reglements),
      db.select().from(demandesValidationStock).where(eq(demandesValidationStock.statut, "EN_ATTENTE")),
    ]);

  return (
    <AffairesClient
      clients={clientRows}
      articles={articleRows}
      variantes={varianteRows}
      affaires={affaireRows}
      lignes={ligneRows}
      reglements={reglementRows}
      demandesEnAttente={demandeRows}
    />
  );
}
