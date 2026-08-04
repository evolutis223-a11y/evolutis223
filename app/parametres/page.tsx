import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { buildShellModules } from "@/lib/shell-modules";
import { chargerUtilisateurAffiche } from "@/lib/session-user";
import { ParametresClient } from "./parametres-client";

export default async function ParametresPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Paramètres")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès aux paramètres.</p>
      </main>
    );
  }

  const user = await chargerUtilisateurAffiche(session.userId);

  return (
    <ParametresClient
      userName={user.nom}
      roleLibelle={user.roleLibelle}
      modules={buildShellModules(session.roleCode)}
    />
  );
}
