import { eq } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { chargerDonneesMaquette } from "./actions";
import { MaquetteClient } from "./maquette-client";

// Route publique (§10ter, proxy.ts PUBLIC_PATHS) — aucune authentification requise, comme
// /boutique et /suivi. Forfaits = les vrais articles Catalogue C-001..C-004 (§10ter).
const FORFAITS_META = [
  { code: "C-001", id: "basique", desc: "Choix bibliothèque, 2 propositions" },
  { code: "C-002", id: "vision", desc: "3 propositions, création originale, 5 retouches", badge: "Recommandé" },
  { code: "C-003", id: "pro", desc: "Fichier à l'échelle 1, prêt à graver, 5 retouches" },
  { code: "C-004", id: "premium", desc: "Dossier technique complet" },
];

export default async function MaquettePage() {
  const [donnees, forfaitArticles] = await Promise.all([
    chargerDonneesMaquette(),
    db
      .select({ id: articles.id, code: articles.code, nom: articles.nom, prixVente: articles.prixVente })
      .from(articles)
      .where(eq(articles.famille, "C")),
  ]);

  const forfaits = FORFAITS_META.map((meta) => {
    const article = forfaitArticles.find((a) => a.code === meta.code);
    return {
      ...meta,
      nom: article?.nom.replace(/^Maquette — /, "").replace(/\s*\(.*\)$/, "") ?? meta.id,
      prix: article ? Number(article.prixVente) : 0,
    };
  });

  return <MaquetteClient donnees={donnees} forfaits={forfaits} />;
}
