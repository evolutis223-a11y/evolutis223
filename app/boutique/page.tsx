import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, branches, variantes, vStockVariante } from "@/db/schema";
import { calculerStockKit } from "@/app/stocks/actions";
import { chargerBanniereBoutique, chargerPromotionsActives } from "@/app/marketing/actions";
import { BoutiqueClient } from "./boutique-client";

// Vitrine publique (§3.2, §10) — aucune authentification, respecte publie_boutique. Le stock
// affiché vient toujours de la réserve détail (jamais du stock gros, §9) : une variante réservée
// au gros n'est jamais "publiable" côté client, quelle que soit la valeur de publie_boutique.
export default async function BoutiquePage() {
  const [articleRows, varianteRows, brancheRows, promotionsActives, banniere] = await Promise.all([
    db.select().from(articles).where(eq(articles.publieBoutique, true)).orderBy(asc(articles.nom)),
    db
      .select({
        id: variantes.id,
        articleId: variantes.articleId,
        taille: variantes.taille,
        couleur: variantes.couleur,
        photoUrl: variantes.photoUrl,
        stockDetail: vStockVariante.stockDetail,
      })
      .from(variantes)
      .leftJoin(vStockVariante, eq(vStockVariante.varianteId, variantes.id)),
    db.select().from(branches),
    chargerPromotionsActives(),
    chargerBanniereBoutique(),
  ]);

  const kitStocks = await Promise.all(
    articleRows.filter((a) => a.famille === "E").map(async (a) => ({
      articleId: a.id,
      ...(await calculerStockKit(a.id)),
    }))
  );

  return (
    <BoutiqueClient
      articles={articleRows}
      variantes={varianteRows}
      branches={brancheRows}
      kitStocks={kitStocks}
      promotions={promotionsActives}
      banniere={banniere}
    />
  );
}
