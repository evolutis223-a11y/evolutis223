"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  articles,
  cadresSerigraphie,
  encresMarquage,
  modelesConfigurateur,
  paliersBroderie,
  parametresMarquage,
  supportsMarquage,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { calculerTotal, type Bibliotheque, type ChargeAdditionnelle, type ZoneConfig } from "@/lib/calculateurs/marquage";
import { creerAffaire, type LigneInput } from "@/app/affaires/actions";

async function requireRdAccess() {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "R&D")) {
    throw new Error("Accès refusé.");
  }
  return session;
}

async function requireAdmin() {
  const session = await getSession();
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.roleCode)) {
    throw new Error("Accès réservé à Admin/Super Admin.");
  }
  return session;
}

export async function chargerBibliotheque(): Promise<Bibliotheque> {
  const [encres, supports, cadres, paliers] = await Promise.all([
    db.select().from(encresMarquage).where(eq(encresMarquage.actif, true)),
    db.select().from(supportsMarquage).where(eq(supportsMarquage.actif, true)),
    db.select().from(cadresSerigraphie).where(eq(cadresSerigraphie.actif, true)),
    db.select().from(paliersBroderie).where(eq(paliersBroderie.actif, true)),
  ]);
  return {
    encres: encres.map((e) => ({
      ...e,
      prixReference: Number(e.prixReference),
      surfaceReferenceCm2: Number(e.surfaceReferenceCm2),
      qteReferenceMl: e.qteReferenceMl != null ? Number(e.qteReferenceMl) : null,
    })),
    supports: supports.map((s) => ({ ...s, prix: Number(s.prix), largeurCm: Number(s.largeurCm), hauteurCm: Number(s.hauteurCm) })),
    cadres: cadres.map((c) => ({ ...c, prixCadre: Number(c.prixCadre) })).sort((a, b) => a.id - b.id),
    paliersBroderie: paliers.map((p) => ({ ...p, prix: Number(p.prix) })).sort((a, b) => a.id - b.id),
  };
}

export interface ModelePret {
  id: number;
  nom: string;
  articleId: number;
  articleNom: string;
  photoUrl: string;
  prixDepart: number;
  zones: { id: string; label: string; technique: string }[];
}

// AJOUT 2026-08-04 : "Modèles prêts" (décision utilisateur) — les modèles déjà définis pour le
// chemin court public (app/configurateur-admin) sont aussi proposables par un vendeur en interne
// depuis R&D, au lieu de repartir d'une configuration libre à chaque fois.
export async function chargerModelesPrets(): Promise<ModelePret[]> {
  const rows = await db
    .select({
      id: modelesConfigurateur.id,
      nom: modelesConfigurateur.nom,
      articleId: modelesConfigurateur.articleId,
      articleNom: articles.nom,
      photoUrl: modelesConfigurateur.photoUrl,
      prixDepart: modelesConfigurateur.prixDepart,
      zones: modelesConfigurateur.zones,
    })
    .from(modelesConfigurateur)
    .innerJoin(articles, eq(articles.id, modelesConfigurateur.articleId))
    .where(eq(modelesConfigurateur.actif, true))
    .orderBy(modelesConfigurateur.id);
  return rows.map((r) => ({
    ...r,
    prixDepart: Number(r.prixDepart),
    zones: r.zones as { id: string; label: string; technique: string }[],
  }));
}

// Prix fixe du modèle × quantité — même règle que calculerCheminCourt (lib/configurateur/prix.ts)
// côté public : le prix d'un modèle prêt n'est jamais recalculé zone par zone, il est figé par
// l'admin à la création du modèle. configMarquage garde une trace des zones pour audit/OF.
export async function creerAffaireDepuisModele(
  clientId: number,
  modeleId: number,
  varianteId: number | null,
  quantite: number
): Promise<{ affaireId?: number; error?: string }> {
  try {
    await requireRdAccess();
    if (!Number.isFinite(quantite) || quantite <= 0) return { error: "Quantité invalide." };
    const [modele] = await db.select().from(modelesConfigurateur).where(eq(modelesConfigurateur.id, modeleId)).limit(1);
    if (!modele || !modele.actif) return { error: "Modèle introuvable." };

    const lignes: LigneInput[] = [
      {
        articleId: modele.articleId,
        varianteId,
        quantite,
        prixUnitaire: Number(modele.prixDepart),
        configMarquage: { modeleId: modele.id, modeleNom: modele.nom, zones: modele.zones },
      },
    ];
    return await creerAffaire(clientId, lignes);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export async function chargerParametresMarquage(): Promise<{ mainOeuvreDefaut: number; margeDefaut: number }> {
  const [row] = await db.select().from(parametresMarquage).limit(1);
  return {
    mainOeuvreDefaut: row ? Number(row.mainOeuvreDefaut) : 200,
    margeDefaut: row ? Number(row.margeDefaut) : 300,
  };
}

export interface BiblioState {
  error: string | null;
}

export async function ajouterEncre(_prevState: BiblioState, formData: FormData): Promise<BiblioState> {
  try {
    await requireAdmin();
    const nom = String(formData.get("nom") ?? "").trim();
    const technique = String(formData.get("technique") ?? "");
    const prixReference = Number(formData.get("prixReference"));
    const volumeReferenceLabel = String(formData.get("volumeReferenceLabel") ?? "").trim();
    const surfaceReferenceCm2 = Number(formData.get("surfaceReferenceCm2"));
    const qteReferenceMlRaw = String(formData.get("qteReferenceMl") ?? "").trim();
    const qteReferenceMl = qteReferenceMlRaw === "" ? null : Number(qteReferenceMlRaw);

    if (!nom) return { error: "Nom requis." };
    if (!["SUBLIMATION", "DTF"].includes(technique)) return { error: "Technique invalide." };
    if (!Number.isFinite(prixReference) || prixReference <= 0) return { error: "Prix invalide." };
    if (!Number.isFinite(surfaceReferenceCm2) || surfaceReferenceCm2 <= 0) return { error: "Surface de référence invalide." };
    if (qteReferenceMl != null && (!Number.isFinite(qteReferenceMl) || qteReferenceMl <= 0)) {
      return { error: "Quantité (ml) invalide." };
    }

    await db.insert(encresMarquage).values({
      nom,
      technique,
      prixReference: prixReference.toFixed(2),
      volumeReferenceLabel: volumeReferenceLabel || null,
      surfaceReferenceCm2: surfaceReferenceCm2.toFixed(2),
      qteReferenceMl: qteReferenceMl != null ? qteReferenceMl.toFixed(2) : null,
    });
    revalidatePath("/rd-calculateurs");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export async function ajouterSupport(_prevState: BiblioState, formData: FormData): Promise<BiblioState> {
  try {
    await requireAdmin();
    const nom = String(formData.get("nom") ?? "").trim();
    const technique = String(formData.get("technique") ?? "");
    const prix = Number(formData.get("prix"));
    const largeurCm = Number(formData.get("largeurCm"));
    const hauteurCm = Number(formData.get("hauteurCm"));

    if (!nom) return { error: "Nom requis." };
    if (!["SUBLIMATION", "DTF", "FLOCAGE"].includes(technique)) return { error: "Technique invalide." };
    if (!Number.isFinite(prix) || prix <= 0) return { error: "Prix invalide." };
    if (!Number.isFinite(largeurCm) || largeurCm <= 0 || !Number.isFinite(hauteurCm) || hauteurCm <= 0) {
      return { error: "Dimensions invalides." };
    }

    await db.insert(supportsMarquage).values({
      nom,
      technique,
      prix: prix.toFixed(2),
      largeurCm: largeurCm.toFixed(2),
      hauteurCm: hauteurCm.toFixed(2),
    });
    revalidatePath("/rd-calculateurs");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export async function ajouterCadre(_prevState: BiblioState, formData: FormData): Promise<BiblioState> {
  try {
    await requireAdmin();
    const nom = String(formData.get("nom") ?? "").trim();
    const prixCadre = Number(formData.get("prixCadre"));
    if (!nom) return { error: "Nom requis." };
    if (!Number.isFinite(prixCadre) || prixCadre < 0) return { error: "Prix invalide." };

    await db.insert(cadresSerigraphie).values({ nom, prixCadre: prixCadre.toFixed(2), ordre: 99 });
    revalidatePath("/rd-calculateurs");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export async function ajouterPalierBroderie(_prevState: BiblioState, formData: FormData): Promise<BiblioState> {
  try {
    await requireAdmin();
    const nom = String(formData.get("nom") ?? "").trim();
    const prix = Number(formData.get("prix"));
    if (!nom) return { error: "Nom requis." };
    if (!Number.isFinite(prix) || prix < 0) return { error: "Prix invalide." };

    await db.insert(paliersBroderie).values({ nom, prix: prix.toFixed(2), ordre: 99 });
    revalidatePath("/rd-calculateurs");
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export async function modifierPrixReference(
  categorie: "encre" | "support" | "cadre" | "broderie",
  id: number,
  nouveauPrix: number
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    if (!Number.isFinite(nouveauPrix) || nouveauPrix < 0) return { error: "Prix invalide." };
    const val = nouveauPrix.toFixed(2);
    if (categorie === "encre") await db.update(encresMarquage).set({ prixReference: val }).where(eq(encresMarquage.id, id));
    else if (categorie === "support") await db.update(supportsMarquage).set({ prix: val }).where(eq(supportsMarquage.id, id));
    else if (categorie === "cadre") await db.update(cadresSerigraphie).set({ prixCadre: val }).where(eq(cadresSerigraphie.id, id));
    else await db.update(paliersBroderie).set({ prix: val }).where(eq(paliersBroderie.id, id));
    revalidatePath("/rd-calculateurs");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export async function modifierQteReferenceMlEncre(id: number, qteMl: number | null): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    if (qteMl != null && (!Number.isFinite(qteMl) || qteMl <= 0)) return { error: "Quantité (ml) invalide." };
    await db
      .update(encresMarquage)
      .set({ qteReferenceMl: qteMl != null ? qteMl.toFixed(2) : null })
      .where(eq(encresMarquage.id, id));
    revalidatePath("/rd-calculateurs");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export async function modifierSurfaceReferenceEncre(id: number, surfaceCm2: number): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    if (!Number.isFinite(surfaceCm2) || surfaceCm2 <= 0) return { error: "Surface de référence invalide." };
    await db.update(encresMarquage).set({ surfaceReferenceCm2: surfaceCm2.toFixed(2) }).where(eq(encresMarquage.id, id));
    revalidatePath("/rd-calculateurs");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export async function retirerReference(
  categorie: "encre" | "support" | "cadre" | "broderie",
  id: number
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    if (categorie === "encre") await db.update(encresMarquage).set({ actif: false }).where(eq(encresMarquage.id, id));
    else if (categorie === "support") await db.update(supportsMarquage).set({ actif: false }).where(eq(supportsMarquage.id, id));
    else if (categorie === "cadre") await db.update(cadresSerigraphie).set({ actif: false }).where(eq(cadresSerigraphie.id, id));
    else await db.update(paliersBroderie).set({ actif: false }).where(eq(paliersBroderie.id, id));
    revalidatePath("/rd-calculateurs");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export async function definirParametresMarquage(
  mainOeuvreDefaut: number,
  margeDefaut: number
): Promise<{ error?: string }> {
  try {
    const session = await requireAdmin();
    if (!Number.isFinite(mainOeuvreDefaut) || mainOeuvreDefaut < 0) return { error: "Main d'œuvre invalide." };
    if (!Number.isFinite(margeDefaut) || margeDefaut < 0) return { error: "Marge invalide." };

    const [existing] = await db.select().from(parametresMarquage).limit(1);
    if (existing) {
      await db
        .update(parametresMarquage)
        .set({
          mainOeuvreDefaut: mainOeuvreDefaut.toFixed(2),
          margeDefaut: margeDefaut.toFixed(2),
          modifiePar: session.userId,
          dateModification: new Date(),
        })
        .where(eq(parametresMarquage.id, existing.id));
    } else {
      await db.insert(parametresMarquage).values({
        mainOeuvreDefaut: mainOeuvreDefaut.toFixed(2),
        margeDefaut: margeDefaut.toFixed(2),
        modifiePar: session.userId,
      });
    }
    revalidatePath("/rd-calculateurs");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export interface LigneBase {
  articleId: number;
  varianteId: number | null;
  quantite: number;
  prixUnitaire: number;
}

export async function creerAffaireAvecMarquage(
  clientId: number,
  ligneBase: LigneBase,
  zones: ZoneConfig[],
  mainOeuvre: number,
  charges: ChargeAdditionnelle[],
  marge: number,
  ligneBas: LigneBase | null
): Promise<{ affaireId?: number; error?: string }> {
  try {
    await requireRdAccess();
    const biblio = await chargerBibliotheque();
    const { zoneResultats, total } = calculerTotal(
      {
        prixBaseArticle: ligneBase.prixUnitaire,
        zones,
        mainOeuvre,
        charges,
        marge,
        prixBas: ligneBas?.prixUnitaire,
      },
      biblio
    );

    const prixLigneHaut = total - (ligneBas?.prixUnitaire ?? 0);

    const lignes: LigneInput[] = [
      {
        articleId: ligneBase.articleId,
        varianteId: ligneBase.varianteId,
        quantite: ligneBase.quantite,
        prixUnitaire: prixLigneHaut,
        configMarquage: { zones, zoneResultats, mainOeuvre, charges, marge },
      },
    ];
    if (ligneBas) {
      lignes.push({
        articleId: ligneBas.articleId,
        varianteId: ligneBas.varianteId,
        quantite: ligneBas.quantite,
        prixUnitaire: ligneBas.prixUnitaire,
      });
    }

    return await creerAffaire(clientId, lignes);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}
