import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { chargerCatalogueVenteComptoir } from "./actions";
import { VenteComptoirClient } from "./vente-comptoir-client";

// §3.3 — poste de vente comptoir avec résilience locale (cache + file d'attente hors ligne).
export default async function VenteComptoirPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Affaires")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès au poste de vente comptoir.</p>
      </main>
    );
  }
  const catalogue = await chargerCatalogueVenteComptoir();
  return <VenteComptoirClient initialCatalogue={catalogue} />;
}
