import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { chargerFraisNumeriques } from "./actions";
import { FraisNumeriquesClient } from "./frais-numeriques-client";

export default async function FraisNumeriquesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Frais numériques")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès à ce registre.</p>
      </main>
    );
  }
  const donnees = await chargerFraisNumeriques();
  return <FraisNumeriquesClient {...donnees} />;
}
