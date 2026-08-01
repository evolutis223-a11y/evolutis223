import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { chargerDonneesRh } from "./actions";
import { RhClient } from "./rh-client";

export default async function RhPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "RH")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès au module RH.</p>
      </main>
    );
  }
  const donnees = await chargerDonneesRh();
  return <RhClient {...donnees} />;
}
