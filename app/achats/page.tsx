import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { chargerDonneesAchats } from "./actions";
import { AchatsClient } from "./achats-client";

export default async function AchatsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Achats")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès aux achats.</p>
      </main>
    );
  }
  const donnees = await chargerDonneesAchats();
  return <AchatsClient {...donnees} />;
}
