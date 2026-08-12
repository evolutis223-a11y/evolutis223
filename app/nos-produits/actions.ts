"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { parametresDocuments } from "@/db/schema";
import { getSession } from "@/lib/auth";

const TYPE_DOCUMENT = "NOS_PRODUITS_CONTENU";

export interface NosProduitsContenu {
  bannerActif: boolean;
  bannerPosition: "haut" | "bas";
  bannerTaille: "fine" | "grande";
  degradeActif: boolean;
}

const NOS_PRODUITS_CONTENU_DEFAUT: NosProduitsContenu = {
  bannerActif: true,
  bannerPosition: "haut",
  bannerTaille: "fine",
  degradeActif: false,
};

export async function chargerContenuNosProduits(): Promise<NosProduitsContenu> {
  const [row] = await db
    .select({ config: parametresDocuments.config })
    .from(parametresDocuments)
    .where(eq(parametresDocuments.typeDocument, TYPE_DOCUMENT))
    .limit(1);
  return { ...NOS_PRODUITS_CONTENU_DEFAUT, ...(row?.config as Partial<NosProduitsContenu> | undefined) };
}

async function requireAdminAccess() {
  const session = await getSession();
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.roleCode)) {
    throw new Error("Accès refusé.");
  }
  return session;
}

export async function enregistrerContenuNosProduits(contenu: NosProduitsContenu): Promise<{ error?: string }> {
  try {
    const session = await requireAdminAccess();
    const [existing] = await db
      .select({ id: parametresDocuments.id })
      .from(parametresDocuments)
      .where(eq(parametresDocuments.typeDocument, TYPE_DOCUMENT))
      .limit(1);
    if (existing) {
      await db
        .update(parametresDocuments)
        .set({ config: contenu, modifiePar: session.userId, dateModification: new Date() })
        .where(eq(parametresDocuments.id, existing.id));
    } else {
      await db.insert(parametresDocuments).values({ typeDocument: TYPE_DOCUMENT, config: contenu, modifiePar: session.userId });
    }
    revalidatePath("/nos-produits");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur." };
  }
}
