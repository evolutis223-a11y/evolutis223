import { desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { affaires, articles, clients, lignesAffaire, livraisons, reglements, roles, utilisateurs, variantes } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { buildShellModules } from "@/lib/shell-modules";
import { chargerParametresAffaireDocument } from "@/lib/documents/parametres";
import { chargerMastheadTexte } from "@/app/parametres/actions";
import { DocumentsClient } from "./documents-client";

const TYPES_DOCUMENTS = ["FACTURE", "DEVIS", "PROFORMA", "BON_COMMANDE", "TICKET"] as const;

export default async function DocumentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Documents")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès aux documents.</p>
      </main>
    );
  }

  const [[user], affaireRows, ligneRows, reglementRows, livraisonRows, masthead, mentionsValiditeEntries] = await Promise.all([
    db
      .select({ nom: utilisateurs.nom, roleLibelle: roles.libelle })
      .from(utilisateurs)
      .innerJoin(roles, eq(utilisateurs.roleId, roles.id))
      .where(eq(utilisateurs.id, session.userId))
      .limit(1),
    db
      .select({
        id: affaires.id,
        numero: affaires.numero,
        type: affaires.type,
        immuable: affaires.immuable,
        dateCreation: affaires.dateCreation,
        objet: affaires.objet,
        provenance: affaires.provenance,
        modeFinalisation: affaires.modeFinalisation,
        tvaPct: affaires.tvaPct,
        remiseMontant: affaires.remiseMontant,
        remiseUnite: affaires.remiseUnite,
        montantTtc: affaires.montantTtc,
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
      .where(inArray(affaires.type, [...TYPES_DOCUMENTS]))
      .orderBy(desc(affaires.id)),
    db.select().from(lignesAffaire),
    db.select().from(reglements),
    db.select({ affaireId: livraisons.affaireId, adresse: livraisons.adresse }).from(livraisons),
    chargerMastheadTexte(),
    Promise.all(TYPES_DOCUMENTS.map(async (t) => [t, (await chargerParametresAffaireDocument(t)).mentionValidite] as const)),
  ]);
  const mentionsValidite = Object.fromEntries(mentionsValiditeEntries);

  const articleRows = await db.select().from(articles);
  const varianteRows = await db.select().from(variantes);

  return (
    <Suspense>
      <DocumentsClient
        userName={user.nom}
        roleLibelle={user.roleLibelle}
        modules={buildShellModules(session.roleCode)}
        affaires={affaireRows}
        lignes={ligneRows}
        reglements={reglementRows}
        livraisons={livraisonRows}
        articles={articleRows}
        variantes={varianteRows}
        masthead={masthead}
        mentionsValidite={mentionsValidite}
      />
    </Suspense>
  );
}
