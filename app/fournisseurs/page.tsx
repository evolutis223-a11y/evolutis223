import { desc, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { fournisseurs, lots } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { FournisseursClient } from "./fournisseurs-client";

export default async function FournisseursPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Fournisseurs")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès au module Fournisseurs.</p>
      </main>
    );
  }

  const [rows, lotCounts] = await Promise.all([
    db.select().from(fournisseurs).orderBy(desc(fournisseurs.id)),
    db
      .select({ fournisseurId: lots.fournisseurId, total: sql<string>`count(*)` })
      .from(lots)
      .where(sql`${lots.fournisseurId} is not null`)
      .groupBy(lots.fournisseurId),
  ]);

  const nbLotsParFournisseur = Object.fromEntries(
    lotCounts.filter((r) => r.fournisseurId !== null).map((r) => [r.fournisseurId as number, Number(r.total)])
  );

  return <FournisseursClient fournisseurs={rows} nbLotsParFournisseur={nbLotsParFournisseur} />;
}
