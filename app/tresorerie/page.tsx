import { redirect } from "next/navigation";
import { db } from "@/db";
import { utilisateurs } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { buildShellModules } from "@/lib/shell-modules";
import { chargerUtilisateurAffiche } from "@/lib/session-user";
import { chargerDonneesTresorerie } from "./actions";
import { TresorerieClient } from "./tresorerie-client";

export default async function TresoreriePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Trésorerie")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès au module Trésorerie.</p>
      </main>
    );
  }

  const [donnees, utilisateursRows, user] = await Promise.all([
    chargerDonneesTresorerie(),
    db.select().from(utilisateurs),
    chargerUtilisateurAffiche(session.userId),
  ]);

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const clotureAujourdhuiExiste = donnees.clotures.some((c) => c.dateCloture === aujourdhui);

  return (
    <TresorerieClient
      userName={user.nom}
      roleLibelle={user.roleLibelle}
      modules={buildShellModules(session.roleCode)}
      utilisateurs={utilisateursRows}
      currentUserId={session.userId}
      isAdmin={["ADMIN", "SUPER_ADMIN"].includes(session.roleCode)}
      clotureAujourdhuiExiste={clotureAujourdhuiExiste}
      {...donnees}
    />
  );
}
