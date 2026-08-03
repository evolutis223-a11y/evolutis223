import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { buildShellModules } from "@/lib/shell-modules";
import { chargerUtilisateurAffiche } from "@/lib/session-user";
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
  const [donnees, user] = await Promise.all([chargerDonneesAchats(), chargerUtilisateurAffiche(session.userId)]);
  return <AchatsClient {...donnees} userName={user.nom} roleLibelle={user.roleLibelle} modules={buildShellModules(session.roleCode)} />;
}
