import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { affaires, articles, clients, variantes } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { CommercialClient } from "./commercial-client";

export default async function CommercialPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Commercial")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès au module Commercial.</p>
      </main>
    );
  }

  const [articleRows, varianteRows, mesProformas] = await Promise.all([
    db.select().from(articles).orderBy(articles.nom),
    db.select().from(variantes),
    db
      .select({
        id: affaires.id,
        numero: affaires.numero,
        statut: affaires.statut,
        montantTtc: affaires.montantTtc,
        clientNom: clients.nom,
        dateCreation: affaires.dateCreation,
      })
      .from(affaires)
      .innerJoin(clients, eq(clients.id, affaires.clientId))
      .where(and(eq(affaires.type, "PROFORMA"), eq(affaires.auteurId, session.userId)))
      .orderBy(desc(affaires.id)),
  ]);

  return <CommercialClient articles={articleRows} variantes={varianteRows} proformas={mesProformas} />;
}
