import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { buildShellModules } from "@/lib/shell-modules";
import { chargerUtilisateurAffiche } from "@/lib/session-user";
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
  const [donnees, user] = await Promise.all([chargerFraisNumeriques(), chargerUtilisateurAffiche(session.userId)]);
  return <FraisNumeriquesClient {...donnees} userName={user.nom} roleLibelle={user.roleLibelle} modules={buildShellModules(session.roleCode)} />;
}
