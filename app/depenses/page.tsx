import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { buildShellModules } from "@/lib/shell-modules";
import { chargerUtilisateurAffiche } from "@/lib/session-user";
import { chargerDonneesDepenses } from "./actions";
import { DepensesClient } from "./depenses-client";

export default async function DepensesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Dépenses") && !hasModuleAccess(session.roleCode, "Charges")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès aux dépenses/charges.</p>
      </main>
    );
  }
  const [donnees, user] = await Promise.all([chargerDonneesDepenses(), chargerUtilisateurAffiche(session.userId)]);
  return <DepensesClient {...donnees} userName={user.nom} roleLibelle={user.roleLibelle} modules={buildShellModules(session.roleCode)} />;
}
