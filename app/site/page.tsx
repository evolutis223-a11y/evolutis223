import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, branches, variantes, vStockVariante } from "@/db/schema";
import { calculerStockKit } from "@/app/stocks/actions";
import { chargerBanniereBoutique, chargerPromotionsActives } from "@/app/marketing/actions";
import { chargerContenuSiteWeb } from "./actions";
import { SiteClient } from "./site-client";

// Site public EVOLUTIS223 (futur "www") — aucune authentification, distinct de /boutique (qui reste
// la vitrine interne "Nos produits") et distinct de "/" (accès employés). Même règle stock que
// /boutique : seule la réserve détail est affichée (§9).
export default async function SitePage() {
  const [articleRows, varianteRows, brancheRows, promotionsActives, banniere, contenu] = await Promise.all([
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
    chargerContenuSiteWeb(),
  ]);

  const kitStocks = await Promise.all(
    articleRows.filter((a) => a.famille === "E").map(async (a) => ({
      articleId: a.id,
      ...(await calculerStockKit(a.id)),
    }))
  );

  return (
    <SiteClient
      articles={articleRows}
      variantes={varianteRows}
      branches={brancheRows}
      kitStocks={kitStocks}
      promotions={promotionsActives}
      banniere={banniere}
      contenu={contenu}
    />
  );
}
