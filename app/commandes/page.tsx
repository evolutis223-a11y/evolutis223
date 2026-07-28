import { desc, eq, isNotNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { affaires, clients, livraisons } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
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

  const [affaireRows, livraisonRows] = await Promise.all([
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
  ]);

  return <CommandesClient affaires={affaireRows} livraisons={livraisonRows} />;
}
