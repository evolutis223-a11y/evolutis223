import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { buildShellModules } from "@/lib/shell-modules";
import { chargerUtilisateurAffiche } from "@/lib/session-user";
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
  const [donnees, user] = await Promise.all([chargerDonneesRh(), chargerUtilisateurAffiche(session.userId)]);
  return <RhClient {...donnees} userName={user.nom} roleLibelle={user.roleLibelle} modules={buildShellModules(session.roleCode)} />;
}
