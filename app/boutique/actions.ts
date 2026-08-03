"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { affaires, clients, utilisateurs } from "@/db/schema";
import { creerAffaireInterne, type LigneInput } from "@/app/affaires/actions";

// Commande publique depuis la boutique (§3.2) — même schéma que le configurateur public
// (app/configurateur/actions.ts) : aucune session, l'auteur de l'affaire est le compte technique
// dédié aux commandes publiques (téléphone +22300000098, seedé en base, sans accès applicatif réel).
const COMPTE_TECHNIQUE_TELEPHONE = "+22300000098";

export interface PanierLigne {
  articleId: number;
  varianteId: number | null;
  quantite: number;
  prixUnitaire: number;
}

export interface CommandeBoutiqueResult {
  affaireId?: number;
  numero?: string;
  error?: string;
}

async function trouverOuCreerClient(nom: string, telephone: string) {
  let [client] = await db.select().from(clients).where(eq(clients.contact, telephone)).limit(1);
  if (!client) {
    [client] = await db.insert(clients).values({ typeClient: "BOUTIQUE", nom, contact: telephone }).returning();
  }
  return client;
}

export async function passerCommandeBoutique(
  nomClient: string,
  telephoneClient: string,
  lignes: PanierLigne[],
  modeFinalisation: "RETRAIT" | "LIVRAISON",
  adresseLivraison: string | null
): Promise<CommandeBoutiqueResult> {
  if (!nomClient.trim() || !telephoneClient.trim()) return { error: "Nom et téléphone requis." };
  if (lignes.length === 0) return { error: "Panier vide." };
  if (modeFinalisation === "LIVRAISON" && !adresseLivraison?.trim()) return { error: "Adresse de livraison requise." };

  const [compteTechnique] = await db
    .select({ id: utilisateurs.id })
    .from(utilisateurs)
    .where(eq(utilisateurs.telephone, COMPTE_TECHNIQUE_TELEPHONE))
    .limit(1);
  if (!compteTechnique) return { error: "Configuration serveur incomplète (compte technique manquant)." };

  const client = await trouverOuCreerClient(nomClient.trim(), telephoneClient.trim());

  const lignesInput: LigneInput[] = lignes.map((l) => ({
    articleId: l.articleId,
    varianteId: l.varianteId,
    quantite: l.quantite,
    prixUnitaire: l.prixUnitaire,
    personnalise: false,
  }));

  const res = await creerAffaireInterne(compteTechnique.id, client.id, lignesInput, modeFinalisation, adresseLivraison, {
    provenance: "Boutique en ligne",
  });
  if (res.error || !res.affaireId) return { error: res.error ?? "Échec de la commande." };

  revalidatePath("/affaires");

  const [affaire] = await db.select({ numero: affaires.numero }).from(affaires).where(eq(affaires.id, res.affaireId)).limit(1);
  return { affaireId: res.affaireId, numero: affaire?.numero };
}
