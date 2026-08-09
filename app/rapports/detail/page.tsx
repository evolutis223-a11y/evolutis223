import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { buildShellModules } from "@/lib/shell-modules";
import { chargerUtilisateurAffiche } from "@/lib/session-user";
import { chargerDetailComplet } from "../actions";
import { RapportDetailClient } from "./detail-client";

export default async function RapportDetailPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Rapports")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès aux rapports.</p>
      </main>
    );
  }
  const [initialDetail, user] = await Promise.all([
    chargerDetailComplet("MOIS"),
    chargerUtilisateurAffiche(session.userId),
  ]);
  return (
    <RapportDetailClient
      userName={user.nom}
      roleLibelle={user.roleLibelle}
      modules={buildShellModules(session.roleCode)}
      initialDetail={initialDetail}
    />
  );
}
