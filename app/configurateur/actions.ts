"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  articles,
  clients,
  finitionsConfigurateur,
  modelesConfigurateur,
  utilisateurs,
  variantes,
  vStockVariante,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { uploadFichier } from "@/lib/blob";
import { chargerBibliotheque } from "@/app/rd-calculateurs/actions";
import { creerAffaireInterne, type LigneInput } from "@/app/affaires/actions";
import { calculerCheminCourt, calculerCheminLong, type FinitionSelection } from "@/lib/configurateur/prix";
import { initierPaiementJemenipay } from "@/lib/jemenipay";
import type { ZoneConfig } from "@/lib/calculateurs/marquage";

// Route publique (§3.3/§10) — aucune session requise pour soumettre une commande (décision
// utilisateur 2026-07-31 : commande directe via le compte technique, pas de file d'attente comme
// le parcours maquette §10ter). Les actions d'administration exigent Admin/Super Admin.
async function requireAdmin() {
  const session = await getSession();
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.roleCode)) {
    throw new Error("Accès réservé à Admin/Super Admin.");
  }
  return session;
}

const COMPTE_TECHNIQUE_TELEPHONE = "+22300000098";

export async function chargerDonneesConfigurateur() {
  const [articleRows, varianteRows, modeleRows, finitionRows, biblio] = await Promise.all([
    db
      .select({
        id: articles.id,
        code: articles.code,
        nom: articles.nom,
        prixVente: articles.prixVente,
        photoUrl: articles.photoUrl,
        categorieMarquage: articles.categorieMarquage,
      })
      .from(articles)
      .where(and(eq(articles.famille, "A"), eq(articles.aVariantes, true))),
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
    db.select().from(modelesConfigurateur).where(eq(modelesConfigurateur.actif, true)),
    db.select().from(finitionsConfigurateur).where(eq(finitionsConfigurateur.actif, true)),
    chargerBibliotheque(),
  ]);

  // Chemin long : polo/t-shirt uniquement pour cette passe (mode "Tissu" hors périmètre — §10bis
  // le distingue déjà par categorieMarquage, on exclut donc ce mode ici).
  const articlesConfigurables = articleRows.filter((a) => a.categorieMarquage !== "TISSU");

  return {
    articles: articlesConfigurables.map((a) => ({ ...a, prixVente: Number(a.prixVente) })),
    variantes: varianteRows.map((v) => ({ ...v, stockDetail: v.stockDetail ?? 0 })),
    modeles: modeleRows.map((m) => ({
      id: m.id,
      nom: m.nom,
      articleId: m.articleId,
      photoUrl: m.photoUrl,
      prixDepart: Number(m.prixDepart),
      zones: m.zones as { id: string; label: string; technique: string; xPct?: number; yPct?: number; largeurCm?: number; hauteurCm?: number }[],
    })),
    finitions: finitionRows.map((f) => ({ id: f.id, nom: f.nom, montant: Number(f.montant) })),
    biblio,
  };
}

export interface UploadState {
  error: string | null;
  url?: string;
}

export async function uploadLogoConfigurateurAction(_prev: UploadState, formData: FormData): Promise<UploadState> {
  try {
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) return { error: "Aucun fichier." };
    const { url } = await uploadFichier(file, "configurateur-logos");
    return { error: null, url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur d'envoi." };
  }
}

interface LigneSoumission {
  taille: string;
  quantite: number;
}

export interface SoumissionCheminLong {
  chemin: "long";
  articleId: number;
  couleur: string;
  coupe: string;
  encolure?: string | null;
  manches?: string | null;
  zones: (ZoneConfig & { logoUrl?: string | null })[];
  finitionIds: number[];
  lignes: LigneSoumission[];
  nomClient: string;
  telephoneClient: string;
  modeFinalisation: "RETRAIT" | "LIVRAISON";
  adresseLivraison: string | null;
}

export interface SoumissionCheminCourt {
  chemin: "court";
  modeleId: number;
  couleur: string;
  logosParZone: Record<string, string>;
  lignes: LigneSoumission[];
  nomClient: string;
  telephoneClient: string;
  modeFinalisation: "RETRAIT" | "LIVRAISON";
  adresseLivraison: string | null;
}

export type SoumissionConfigurateur = SoumissionCheminLong | SoumissionCheminCourt;

export interface SoumissionResult {
  error?: string;
  numero?: string;
  affaireId?: number;
  total?: number;
  paiementMobileMoney?: { ok: boolean; transactionId?: string; error?: string };
}

async function trouverOuCreerClient(nom: string, telephone: string) {
  let [client] = await db.select().from(clients).where(eq(clients.contact, telephone)).limit(1);
  if (!client) {
    [client] = await db.insert(clients).values({ typeClient: "BOUTIQUE", nom, contact: telephone }).returning();
  }
  return client;
}

async function resoudreVariantes(articleId: number, couleur: string, lignes: LigneSoumission[]) {
  const tailles = lignes.map((l) => l.taille);
  const rows = await db
    .select({ id: variantes.id, taille: variantes.taille })
    .from(variantes)
    .where(and(eq(variantes.articleId, articleId), eq(variantes.couleur, couleur), inArray(variantes.taille, tailles)));
  const parTaille = new Map(rows.map((r) => [r.taille, r.id]));
  return lignes.map((l) => ({ ...l, varianteId: parTaille.get(l.taille) ?? null }));
}

export async function soumettreCommandePublique(payload: SoumissionConfigurateur): Promise<SoumissionResult> {
  if (!payload.nomClient.trim() || !payload.telephoneClient.trim()) {
    return { error: "Nom et téléphone requis." };
  }
  const lignesValides = payload.lignes.filter((l) => l.quantite > 0);
  if (lignesValides.length === 0) return { error: "Au moins une taille/quantité requise." };
  if (payload.modeFinalisation === "LIVRAISON" && !payload.adresseLivraison?.trim()) {
    return { error: "Adresse de livraison requise." };
  }

  const [compteTechnique] = await db
    .select({ id: utilisateurs.id })
    .from(utilisateurs)
    .where(eq(utilisateurs.telephone, COMPTE_TECHNIQUE_TELEPHONE))
    .limit(1);
  if (!compteTechnique) return { error: "Configuration serveur incomplète (compte technique manquant)." };

  const quantiteTotale = lignesValides.reduce((acc, l) => acc + l.quantite, 0);
  const client = await trouverOuCreerClient(payload.nomClient.trim(), payload.telephoneClient.trim());

  let lignesAffaireInput: LigneInput[];
  let total: number;
  let configMarquage: unknown = null;

  if (payload.chemin === "court") {
    const [modele] = await db.select().from(modelesConfigurateur).where(eq(modelesConfigurateur.id, payload.modeleId)).limit(1);
    if (!modele || !modele.actif) return { error: "Modèle introuvable." };
    const varianteResolues = await resoudreVariantes(modele.articleId, payload.couleur, lignesValides);
    total = calculerCheminCourt(Number(modele.prixDepart), quantiteTotale);
    configMarquage = { chemin: "court", modeleId: modele.id, couleur: payload.couleur, logosParZone: payload.logosParZone };
    lignesAffaireInput = varianteResolues.map((l) => ({
      articleId: modele.articleId,
      varianteId: l.varianteId,
      quantite: l.quantite,
      prixUnitaire: Number(modele.prixDepart),
      configMarquage,
    }));
  } else {
    const [article] = await db.select().from(articles).where(eq(articles.id, payload.articleId)).limit(1);
    if (!article) return { error: "Article introuvable." };
    const biblio = await chargerBibliotheque();
    const finitionRows = payload.finitionIds.length
      ? await db.select().from(finitionsConfigurateur).where(inArray(finitionsConfigurateur.id, payload.finitionIds))
      : [];
    const finitions: FinitionSelection[] = finitionRows.map((f) => ({ id: f.id, nom: f.nom, montant: Number(f.montant) }));

    const resultat = calculerCheminLong(
      { prixArticle: Number(article.prixVente), zones: payload.zones, finitions, quantiteTotale },
      biblio
    );
    total = resultat.total;
    configMarquage = {
      chemin: "long",
      couleur: payload.couleur,
      coupe: payload.coupe,
      encolure: payload.encolure ?? null,
      manches: payload.manches ?? null,
      zones: payload.zones,
      finitions,
      detail: resultat,
    };
    const varianteResolues = await resoudreVariantes(article.id, payload.couleur, lignesValides);
    lignesAffaireInput = varianteResolues.map((l) => ({
      articleId: article.id,
      varianteId: l.varianteId,
      quantite: l.quantite,
      prixUnitaire: resultat.prixUnitaireTotal,
      configMarquage,
    }));
  }

  if (lignesAffaireInput.some((l) => !l.varianteId)) {
    return { error: "Couleur/taille indisponible pour cet article." };
  }

  const res = await creerAffaireInterne(
    compteTechnique.id,
    client.id,
    lignesAffaireInput,
    payload.modeFinalisation,
    payload.adresseLivraison
  );
  if (res.error || !res.affaireId) return { error: res.error ?? "Échec de création de la commande." };

  revalidatePath("/affaires");

  // Paiement Mobile Money (§12, Jemenipay) — non bloquant : la commande reste créée même si
  // l'initiation échoue (identifiants pas encore configurés, agrégateur indisponible, etc.), le
  // client peut alors régler autrement (le vendeur/technicien sera de toute façon notifié).
  let paiementMobileMoney: SoumissionResult["paiementMobileMoney"];
  try {
    paiementMobileMoney = await initierPaiementJemenipay({
      montant: total,
      telephone: payload.telephoneClient.trim(),
      reference: res.numero ?? String(res.affaireId),
      description: `Commande EVOLUTIS223 ${res.numero ?? ""}`.trim(),
    });
  } catch (err) {
    paiementMobileMoney = { ok: false, error: err instanceof Error ? err.message : "Erreur d'initiation du paiement." };
  }

  return { affaireId: res.affaireId, numero: res.numero, total, paiementMobileMoney };
}

// ---- Administration (Admin/Super Admin) — galerie de modèles chemin court + finitions ----

export async function ajouterModeleConfigurateur(_prev: UploadState, formData: FormData): Promise<UploadState> {
  try {
    await requireAdmin();
    const file = formData.get("file") as File | null;
    const nom = String(formData.get("nom") ?? "").trim();
    const articleId = Number(formData.get("articleId"));
    const prixDepart = Number(formData.get("prixDepart"));
    if (!file || file.size === 0) return { error: "Aucun fichier." };
    if (!nom) return { error: "Nom requis." };
    if (!articleId) return { error: "Article requis." };
    if (!Number.isFinite(prixDepart) || prixDepart <= 0) return { error: "Prix invalide." };

    const { url } = await uploadFichier(file, "configurateur-modeles");
    await db.insert(modelesConfigurateur).values({
      nom,
      articleId,
      photoUrl: url,
      prixDepart: prixDepart.toFixed(2),
      zones: [{ id: "z1", label: "Logo poitrine", technique: "DTF", xPct: 50, yPct: 30, largeurCm: 10, hauteurCm: 10 }],
    });
    revalidatePath("/configurateur-admin");
    return { error: null, url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur." };
  }
}

export async function retirerModeleConfigurateur(id: number) {
  await requireAdmin();
  await db.update(modelesConfigurateur).set({ actif: false }).where(eq(modelesConfigurateur.id, id));
  revalidatePath("/configurateur-admin");
}

// Les zones de logo prédéfinies (chemin court) étaient figées à une seule zone codée en dur à la
// création du modèle (§10) — l'Admin n'avait aucun moyen réel de les modifier. Remplace ce
// placeholder par une vraie édition (ajout/suppression/technique) par modèle.
export async function definirZonesModele(
  modeleId: number,
  zones: { id: string; label: string; technique: string; xPct?: number; yPct?: number; largeurCm?: number; hauteurCm?: number }[]
) {
  await requireAdmin();
  if (zones.length === 0) throw new Error("Un modèle doit garder au moins une zone de logo.");
  await db.update(modelesConfigurateur).set({ zones }).where(eq(modelesConfigurateur.id, modeleId));
  revalidatePath("/configurateur-admin");
  revalidatePath("/configurateur");
}

export interface FinitionState {
  error: string | null;
}

export async function ajouterFinition(_prev: FinitionState, formData: FormData): Promise<FinitionState> {
  try {
    await requireAdmin();
    const nom = String(formData.get("nom") ?? "").trim();
    const montant = Number(formData.get("montant"));
    if (!nom) return { error: "Nom requis." };
    if (!Number.isFinite(montant) || montant < 0) return { error: "Montant invalide." };
    await db.insert(finitionsConfigurateur).values({ nom, montant: montant.toFixed(2), ordre: 99 });
    revalidatePath("/configurateur-admin");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur." };
  }
}

export async function retirerFinition(id: number) {
  await requireAdmin();
  await db.update(finitionsConfigurateur).set({ actif: false }).where(eq(finitionsConfigurateur.id, id));
  revalidatePath("/configurateur-admin");
}
