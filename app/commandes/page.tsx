import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { affaires, clients, fondsCirculation, livraisons, reglements } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { buildShellModules } from "@/lib/shell-modules";
import { chargerUtilisateurAffiche } from "@/lib/session-user";
import { listerLivreurs } from "./actions";
import { CommandesClient } from "./commandes-client";

export default async function CommandesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Commandes")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès au module Commandes.</p>
      </main>
    );
  }

  const [affaireRows, livraisonRows, livreurRows, reglementSums] = await Promise.all([
    db
      .select({
        id: affaires.id,
        numero: affaires.numero,
        statut: affaires.statut,
        modeFinalisation: affaires.modeFinalisation,
        montantTtc: affaires.montantTtc,
        clientNom: clients.nom,
      })
      .from(affaires)
      .innerJoin(clients, eq(clients.id, affaires.clientId))
      .where(isNotNull(affaires.modeFinalisation))
      .orderBy(desc(affaires.id)),
    db.select().from(livraisons),
    listerLivreurs(),
    db
      .select({ affaireId: reglements.affaireId, total: sql<string>`coalesce(sum(${reglements.montant}), 0)` })
      .from(reglements)
      .groupBy(reglements.affaireId),
  ]);

  const soldeParAffaire = new Map(reglementSums.map((r) => [r.affaireId, Number(r.total)]));

  let mesFondsEnCirculation: { affaireNumero: string; montantAttendu: string }[] = [];
  if (["LIVREUR", "LIVREUR_PARTENAIRE"].includes(session.roleCode)) {
    mesFondsEnCirculation = await db
      .select({ affaireNumero: affaires.numero, montantAttendu: fondsCirculation.montantAttendu })
      .from(fondsCirculation)
      .innerJoin(affaires, eq(affaires.id, fondsCirculation.affaireId))
      .where(and(eq(fondsCirculation.livreurId, session.userId), eq(fondsCirculation.statut, "EN_CIRCULATION")));
  }

  const user = await chargerUtilisateurAffiche(session.userId);

  return (
    <CommandesClient
      userName={user.nom}
      roleLibelle={user.roleLibelle}
      modules={buildShellModules(session.roleCode)}
      affaires={affaireRows}
      livraisons={livraisonRows}
      livreurs={livreurRows}
      soldeParAffaire={Object.fromEntries(soldeParAffaire)}
      mesFondsEnCirculation={mesFondsEnCirculation}
    />
  );
}
