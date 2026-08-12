import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { articles, branches, variantes, vStockVariante } from "@/db/schema";
import { calculerStockKit } from "@/app/stocks/actions";
import { chargerBanniereBoutique, chargerPromotionsActives } from "@/app/marketing/actions";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { chargerContenuNosProduits, verifierLienParrainage } from "./actions";
import { NosProduitsClient } from "./nos-produits-client";

function PageMessage({ texte }: { texte: string }) {
  return (
    <main style={{ minHeight: "100vh", background: "#121212", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <p style={{ fontSize: 13.5, color: "#9a988f", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", textAlign: "center" }}>{texte}</p>
    </main>
  );
}

// Présentoir "Nos produits" (2026-08-12) — remplace l'ancien raccourci vers /boutique dans le menu
// interne. Pensé pour une présentation tablette (démarcheurs, clients, partenaires) : vignettes,
// plein écran, galerie, liste. Accessible soit avec une session interne, soit via le lien de
// parrainage d'un commercial (?ref=CODE, système déjà construit dans Commercial — réutilisé ici
// plutôt que dupliqué, § décision 2026-08-12).
export default async function NosProduitsPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const session = await getSession();

  if (!session) {
    if (!ref) redirect("/login");
    const verif = await verifierLienParrainage(ref);
    if (!verif.valide) return <PageMessage texte="Ce lien n'est plus valide. Contactez la personne qui vous l'a envoyé." />;
  } else if (!hasModuleAccess(session.roleCode, "Nos produits")) {
    return (
      <main style={{ padding: 24 }}>
        <p style={{ fontSize: 13, color: "#888" }}>Ce rôle n&apos;a pas accès à Nos produits.</p>
      </main>
    );
  }

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
    chargerContenuNosProduits(),
  ]);

  const kitStocks = await Promise.all(
    articleRows.filter((a) => a.famille === "E").map(async (a) => ({
      articleId: a.id,
      ...(await calculerStockKit(a.id)),
    }))
  );

  return (
    <NosProduitsClient
      articles={articleRows}
      variantes={varianteRows}
      branches={brancheRows}
      kitStocks={kitStocks}
      promotions={promotionsActives}
      banniere={banniere}
      contenu={contenu}
      estAdmin={session ? ["ADMIN", "SUPER_ADMIN"].includes(session.roleCode) : false}
    />
  );
}
