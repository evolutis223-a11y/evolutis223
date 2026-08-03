import { asc, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { articles, branches, utilisateurs, roles } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { buildShellModules } from "@/lib/shell-modules";
import { CatalogueClient } from "./catalogue-client";

export default async function CataloguePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Catalogue")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">
          Ce rôle n&apos;a pas accès au module Catalogue.
        </p>
      </main>
    );
  }

  const [[user], rows, brancheRows] = await Promise.all([
    db
      .select({ nom: utilisateurs.nom, roleLibelle: roles.libelle })
      .from(utilisateurs)
      .innerJoin(roles, eq(utilisateurs.roleId, roles.id))
      .where(eq(utilisateurs.id, session.userId))
      .limit(1),
    db.select().from(articles).orderBy(desc(articles.id)),
    db.select().from(branches).orderBy(asc(branches.nom)),
  ]);

  return (
    <CatalogueClient
      userName={user.nom}
      roleLibelle={user.roleLibelle}
      modules={buildShellModules(session.roleCode)}
      articles={rows}
      branches={brancheRows}
      isSuperAdmin={session.roleCode === "SUPER_ADMIN"}
    />
  );
}
