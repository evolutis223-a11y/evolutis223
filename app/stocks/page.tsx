import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { articles, variantes, vStockVariante } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { StocksClient } from "./stocks-client";

export default async function StocksPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Stocks")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès au module Stocks.</p>
      </main>
    );
  }

  const [articleRows, variantRows] = await Promise.all([
    db.select().from(articles).orderBy(desc(articles.id)),
    db
      .select({
        id: variantes.id,
        articleId: variantes.articleId,
        taille: variantes.taille,
        couleur: variantes.couleur,
        seuilAlerte: variantes.seuilAlerte,
        stockDetail: vStockVariante.stockDetail,
        stockGros: vStockVariante.stockGros,
        reserveDetail: vStockVariante.reserveDetail,
      })
      .from(variantes)
      .leftJoin(vStockVariante, eq(vStockVariante.varianteId, variantes.id)),
  ]);

  return <StocksClient articles={articleRows} variantes={variantRows} />;
}
