"use server";

import { eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { articles, clients, variantes, vStockVariante } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { creerAffaire, type LigneInput } from "@/app/affaires/actions";

// §3.3 — "Le poste dédié à la boutique garde une résilience locale : cache du catalogue/prix +
// file d'attente de synchronisation, pour qu'une coupure internet momentanée n'empêche pas
// d'encaisser au comptoir." Décidé dès le cadrage initial, jamais construit avant le 2026-08-02.
//
// Écran séparé de /affaires (pas une modification du flux Devis/B2B existant, plus risqué à
// toucher) : volontairement simple — choisir un article/variante, une quantité, un client, encaisser.
// La mise en cache + file d'attente vivent entièrement dans le navigateur (localStorage côté
// vente-comptoir-client.tsx) — ce n'est PAS une base de données locale complète (§3.3 le précise),
// juste un tampon pour ce poste précis. Une fois la connexion revenue, chaque vente en attente
// repasse par creerAffaire() normal — le contrôle réserve détail (§9) s'applique donc exactement
// comme pour une vente saisie en direct, aucune logique de blocage dupliquée.

async function requireAccess() {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Affaires")) {
    throw new Error("Accès refusé.");
  }
  return session;
}

export interface CatalogueComptoirArticle {
  id: number;
  nom: string;
  code: string;
  famille: string;
  prixVente: number;
}
export interface CatalogueComptoirVariante {
  id: number;
  articleId: number;
  taille: string | null;
  couleur: string | null;
  stockDetail: number;
}

export async function chargerCatalogueVenteComptoir(): Promise<{
  articles: CatalogueComptoirArticle[];
  variantes: CatalogueComptoirVariante[];
}> {
  await requireAccess();

  const [articleRows, varianteRows] = await Promise.all([
    db
      .select({ id: articles.id, nom: articles.nom, code: articles.code, famille: articles.famille, prixVente: articles.prixVente })
      .from(articles)
      .where(or(eq(articles.famille, "A"), eq(articles.famille, "B"))),
    db
      .select({
        id: variantes.id,
        articleId: variantes.articleId,
        taille: variantes.taille,
        couleur: variantes.couleur,
        stockDetail: vStockVariante.stockDetail,
      })
      .from(variantes)
      .leftJoin(vStockVariante, eq(vStockVariante.varianteId, variantes.id)),
  ]);

  return {
    articles: articleRows.map((a) => ({ ...a, prixVente: Number(a.prixVente) })),
    variantes: varianteRows.map((v) => ({ ...v, stockDetail: v.stockDetail ?? 0 })),
  };
}

export interface VenteComptoirLigne {
  articleId: number;
  varianteId: number;
  quantite: number;
  prixUnitaire: number;
}

export interface VenteComptoirResult {
  error?: string;
  affaireId?: number;
  numero?: string;
}

// Appelée soit tout de suite (vente en ligne), soit plus tard par la file d'attente locale une
// fois la connexion revenue — même fonction dans les deux cas, aucune différence de traitement.
export async function encaisserVenteComptoir(
  nomClient: string,
  telephoneClient: string,
  lignes: VenteComptoirLigne[]
): Promise<VenteComptoirResult> {
  try {
    await requireAccess();
    if (!nomClient.trim() || !telephoneClient.trim()) return { error: "Nom et téléphone du client requis." };
    if (lignes.length === 0) return { error: "Au moins une ligne requise." };

    let [client] = await db.select().from(clients).where(eq(clients.contact, telephoneClient.trim())).limit(1);
    if (!client) {
      [client] = await db
        .insert(clients)
        .values({ typeClient: "BOUTIQUE", nom: nomClient.trim(), contact: telephoneClient.trim() })
        .returning();
    }

    const lignesInput: LigneInput[] = lignes.map((l) => ({
      articleId: l.articleId,
      varianteId: l.varianteId,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire,
      personnalise: false,
    }));

    const res = await creerAffaire(client.id, lignesInput, "RETRAIT");
    if (res.error || !res.affaireId) return { error: res.error ?? "Échec de création de la vente." };

    revalidatePath("/affaires");
    return { affaireId: res.affaireId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}
