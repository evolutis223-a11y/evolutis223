import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { buildShellModules } from "@/lib/shell-modules";
import { chargerUtilisateurAffiche } from "@/lib/session-user";
import { chargerRapportFinance, chargerRapportRh } from "./actions";
import { RapportsClient } from "./rapports-client";

export default async function RapportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Rapports")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès aux rapports.</p>
      </main>
    );
  }
  const [initialFinance, initialRh, user] = await Promise.all([
    chargerRapportFinance("MOIS"),
    chargerRapportRh("MOIS"),
    chargerUtilisateurAffiche(session.userId),
  ]);
  return (
    <RapportsClient
      userName={user.nom}
      roleLibelle={user.roleLibelle}
      modules={buildShellModules(session.roleCode)}
      initialFinance={initialFinance}
      initialRh={initialRh}
    />
  );
}
