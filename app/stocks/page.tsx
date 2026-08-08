import { desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { articles, variantes, vStockVariante, utilisateurs, roles, lots, lotVariantes, fournisseurs } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { buildShellModules } from "@/lib/shell-modules";
import { calculerStockKit, listerFournisseursActifs, listerRecetteKit } from "./actions";
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

  const [[user], articleRows, variantRows, fournisseurRows, lotRows] = await Promise.all([
    db
      .select({ nom: utilisateurs.nom, roleLibelle: roles.libelle })
      .from(utilisateurs)
      .innerJoin(roles, eq(utilisateurs.roleId, roles.id))
      .where(eq(utilisateurs.id, session.userId))
      .limit(1),
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
    listerFournisseursActifs(),
    db
      .select({
        id: lots.id,
        articleId: lots.articleId,
        dateReception: lots.dateReception,
        prixAchatUnitaire: lots.prixAchatUnitaire,
        fournisseurNom: fournisseurs.nom,
        quantite: sql<number>`coalesce(sum(${lotVariantes.quantiteProduite}), 0)`,
      })
      .from(lots)
      .leftJoin(fournisseurs, eq(fournisseurs.id, lots.fournisseurId))
      .leftJoin(lotVariantes, eq(lotVariantes.lotId, lots.id))
      .groupBy(lots.id, fournisseurs.nom)
      .orderBy(desc(lots.dateReception))
      .limit(300),
  ]);

  const kitArticles = articleRows.filter((a) => a.famille === "E");
  const kits = await Promise.all(
    kitArticles.map(async (k) => ({
      article: k,
      recette: await listerRecetteKit(k.id),
      stock: await calculerStockKit(k.id),
    }))
  );

  return (
    <StocksClient
      userName={user.nom}
      roleLibelle={user.roleLibelle}
      modules={buildShellModules(session.roleCode)}
      articles={articleRows}
      variantes={variantRows}
      kits={kits}
      fournisseurs={fournisseurRows}
      lots={lotRows.map((l) => ({ ...l, prixAchatUnitaire: Number(l.prixAchatUnitaire), quantite: Number(l.quantite) }))}
    />
  );
}
