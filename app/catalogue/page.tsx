import { asc, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { articles, branches } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
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

  const [rows, brancheRows] = await Promise.all([
    db.select().from(articles).orderBy(desc(articles.id)),
    db.select().from(branches).orderBy(asc(branches.nom)),
  ]);

  return <CatalogueClient articles={rows} branches={brancheRows} />;
}
