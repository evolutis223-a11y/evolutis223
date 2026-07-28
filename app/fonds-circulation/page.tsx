import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { affaires, fondsCirculation, utilisateurs } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { FondsCirculationClient } from "./fonds-circulation-client";

export default async function FondsCirculationPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Trésorerie")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès à ce module.</p>
      </main>
    );
  }

  const rows = await db
    .select({
      id: fondsCirculation.id,
      livreurNom: utilisateurs.nom,
      affaireNumero: affaires.numero,
      montantAttendu: fondsCirculation.montantAttendu,
      montantRemis: fondsCirculation.montantRemis,
      statut: fondsCirculation.statut,
      dateRemise: fondsCirculation.dateRemise,
    })
    .from(fondsCirculation)
    .innerJoin(utilisateurs, eq(utilisateurs.id, fondsCirculation.livreurId))
    .innerJoin(affaires, eq(affaires.id, fondsCirculation.affaireId))
    .orderBy(desc(fondsCirculation.id))
    .limit(200);

  return <FondsCirculationClient fonds={rows} />;
}
