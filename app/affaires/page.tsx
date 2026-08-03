import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  utilisateurs,
  roles,
  affaires,
  articles,
  clients,
  demandesValidationStock,
  lignesAffaire,
  reglements,
  variantes,
  vStockVariante,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { buildShellModules } from "@/lib/shell-modules";
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

  const [[user], articleRows, varianteRows, affaireRows, ligneRows, reglementRows, demandeRows] =
    await Promise.all([
      db
        .select({ nom: utilisateurs.nom, roleLibelle: roles.libelle })
        .from(utilisateurs)
        .innerJoin(roles, eq(utilisateurs.roleId, roles.id))
        .where(eq(utilisateurs.id, session.userId))
        .limit(1),
      db.select().from(articles).orderBy(articles.nom),
      db
        .select({
          id: variantes.id,
          articleId: variantes.articleId,
          taille: variantes.taille,
          couleur: variantes.couleur,
          stockDetail: vStockVariante.stockDetail,
        })
        .from(variantes)
        .leftJoin(vStockVariante, eq(vStockVariante.varianteId, variantes.id)),
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
          objet: affaires.objet,
          provenance: affaires.provenance,
          clientAdresse: clients.adresse,
          clientTelephone: clients.contact,
          tvaPct: affaires.tvaPct,
          remiseMontant: affaires.remiseMontant,
          remiseUnite: affaires.remiseUnite,
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
      userName={user.nom}
      roleLibelle={user.roleLibelle}
      roleCode={session.roleCode}
      modules={buildShellModules(session.roleCode)}
      articles={articleRows}
      variantes={varianteRows}
      affaires={affaireRows}
      lignes={ligneRows}
      reglements={reglementRows}
      demandesEnAttente={demandeRows}
    />
  );
}
