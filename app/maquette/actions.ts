"use server";

import { eq, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { articles, demandesMaquette, dispositionsMaquette, modelesMaquette, parametresParcoursMaquette } from "@/db/schema";
import { uploadFichier } from "@/lib/blob";
import { getSession } from "@/lib/auth";

// Route publique (§10ter) — aucune session requise pour soumettre une demande. Les actions
// d'administration (bibliothèque, dispositions) exigent Admin/Super Admin, vérifié ci-dessous.
async function requireAdmin() {
  const session = await getSession();
  // Pas de module "Maquette" dédié dans la matrice de permissions (§6/§7) — plutôt que d'en
  // inventer un sans feu vert, réservé Admin/Super Admin comme les autres écrans de config
  // système (bibliothèque R&D, seuils trésorerie, etc.).
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.roleCode)) {
    throw new Error("Accès réservé à Admin/Super Admin.");
  }
  return session;
}

export async function chargerDonneesMaquette() {
  const [modeles, dispositions, paramRows] = await Promise.all([
    db.select().from(modelesMaquette).where(eq(modelesMaquette.actif, true)),
    db.select().from(dispositionsMaquette),
    db.select().from(parametresParcoursMaquette).limit(1),
  ]);
  const dispositionsMap: Record<number, { positions: [number, number][]; verrouille: boolean }> = {};
  for (const d of dispositions) {
    dispositionsMap[d.nbElements] = { positions: d.positions as [number, number][], verrouille: d.verrouille };
  }
  const param = paramRows[0];
  return {
    modeles: modeles.map((m) => ({ id: m.id, blobUrl: m.blobUrl, tag: m.tag })),
    dispositions: dispositionsMap,
    badgeForme: param?.badgeForme ?? "circle",
    badgeTaille: param ? Number(param.badgeTaille) : 1,
  };
}

export interface UploadState {
  error: string | null;
  url?: string;
}

export async function uploadLogoAction(_prev: UploadState, formData: FormData): Promise<UploadState> {
  try {
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) return { error: "Aucun fichier." };
    const { url } = await uploadFichier(file, "maquette-logos");
    return { error: null, url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur d'envoi." };
  }
}

async function genererNumeroMaquette(): Promise<string> {
  const annee = new Date().getFullYear().toString().slice(-2);
  const rows = await db
    .select({ numero: demandesMaquette.numero })
    .from(demandesMaquette)
    .where(like(demandesMaquette.numero, `MAQ-${annee}-%`));
  const seq = rows.length + 1;
  return `MAQ-${annee}-${seq.toString().padStart(4, "0")}`;
}

export interface DemandeMaquettePayload {
  nomClient: string;
  telephoneClient: string;
  adresseClient?: string;
  intent: "maquette" | "pagne";
  forfaitCode: string; // ex "C-001" — le forfait choisi, converti en articleId ici
  details: {
    depart: string | null;
    modelesChoisis: number[];
    elements: { type: "logo" | "texte"; src?: string; content?: string }[];
    nbElements: number | string | null;
    disposition: [number, number][];
    couleurType: string | null;
    couleurs: string[];
    explication: string;
    livraisonMode: string | null;
    impressionVoulue: boolean;
  };
}

export interface SoumettreState {
  error: string | null;
  numero?: string;
}

export async function soumettreDemande(payload: DemandeMaquettePayload): Promise<SoumettreState> {
  if (!payload.nomClient.trim() || !payload.telephoneClient.trim()) {
    return { error: "Nom et téléphone requis." };
  }
  const [forfaitArticle] = payload.forfaitCode
    ? await db.select({ id: articles.id }).from(articles).where(eq(articles.code, payload.forfaitCode)).limit(1)
    : [];

  const numero = await genererNumeroMaquette();
  await db.insert(demandesMaquette).values({
    numero,
    nomClient: payload.nomClient.trim(),
    telephoneClient: payload.telephoneClient.trim(),
    adresseClient: payload.adresseClient?.trim() || null,
    intent: payload.intent,
    forfaitArticleId: forfaitArticle?.id ?? null,
    details: payload.details,
  });

  revalidatePath("/validations");
  return { error: null, numero };
}

// ---- Administration (Admin/Super Admin) ----

export async function ajouterModele(_prev: UploadState, formData: FormData): Promise<UploadState> {
  try {
    await requireAdmin();
    const file = formData.get("file") as File | null;
    const tag = String(formData.get("tag") ?? "chaud");
    if (!file || file.size === 0) return { error: "Aucun fichier." };
    const { url } = await uploadFichier(file, "maquette-modeles");
    await db.insert(modelesMaquette).values({ blobUrl: url, tag });
    revalidatePath("/maquette-admin");
    return { error: null, url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur." };
  }
}

export async function retirerModele(id: number) {
  await requireAdmin();
  await db.update(modelesMaquette).set({ actif: false }).where(eq(modelesMaquette.id, id));
  revalidatePath("/maquette-admin");
}

export async function definirDisposition(nbElements: number, positions: [number, number][]) {
  await requireAdmin();
  await db
    .update(dispositionsMaquette)
    .set({ positions })
    .where(eq(dispositionsMaquette.nbElements, nbElements));
  revalidatePath("/maquette-admin");
}

export async function basculerVerrouillage(nbElements: number, verrouille: boolean) {
  await requireAdmin();
  await db.update(dispositionsMaquette).set({ verrouille }).where(eq(dispositionsMaquette.nbElements, nbElements));
  revalidatePath("/maquette-admin");
}

export async function definirParametresParcours(badgeForme: string, badgeTaille: number) {
  const session = await requireAdmin();
  const [existing] = await db.select().from(parametresParcoursMaquette).limit(1);
  if (existing) {
    await db
      .update(parametresParcoursMaquette)
      .set({ badgeForme, badgeTaille: badgeTaille.toFixed(2), modifiePar: session.userId, dateModification: new Date() })
      .where(eq(parametresParcoursMaquette.id, existing.id));
  } else {
    await db.insert(parametresParcoursMaquette).values({ badgeForme, badgeTaille: badgeTaille.toFixed(2), modifiePar: session.userId });
  }
  revalidatePath("/maquette-admin");
}
