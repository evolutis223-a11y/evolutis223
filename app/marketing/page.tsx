import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { chargerDonneesMarketing } from "./actions";
import { MarketingClient } from "./marketing-client";

export default async function MarketingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Marketing")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès au module Marketing.</p>
      </main>
    );
  }
  const donnees = await chargerDonneesMarketing();
  return <MarketingClient {...donnees} />;
}
