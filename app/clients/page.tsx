import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { clients, utilisateurs, roles } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { buildShellModules } from "@/lib/shell-modules";
import { ClientsClient } from "./clients-client";

export default async function ClientsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Clients")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès au module Clients.</p>
      </main>
    );
  }

  const [[user], rows] = await Promise.all([
    db
      .select({ nom: utilisateurs.nom, roleLibelle: roles.libelle })
      .from(utilisateurs)
      .innerJoin(roles, eq(utilisateurs.roleId, roles.id))
      .where(eq(utilisateurs.id, session.userId))
      .limit(1),
    db.select().from(clients).orderBy(desc(clients.id)),
  ]);
  return <ClientsClient userName={user.nom} roleLibelle={user.roleLibelle} modules={buildShellModules(session.roleCode)} clients={rows} />;
}
