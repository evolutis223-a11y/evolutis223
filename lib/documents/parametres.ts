// Chargement du paramétrage par champs/sections des documents imprimables (§13, tranché
// 2026-07-28 — option 1). Une ligne `parametres_documents` par type, `config` en JSONB
// libre par générateur ; ce module fournit juste le chargement + les valeurs par défaut,
// jamais de mise en page (ça reste dans chaque *.tsx de lib/documents/).

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { parametresDocuments } from "@/db/schema";

export type TypeDocument = "RECU_CAISSE" | "BON_LIVRAISON" | "BON_COMMANDE" | "FICHE_PAIE" | "ORDRE_MISSION" | "COURRIER";

export interface ParametresRecuCaisse {
  afficherMentionsLegales: boolean;
  messageRemerciement: string;
}

export const DEFAUTS_RECU_CAISSE: ParametresRecuCaisse = {
  afficherMentionsLegales: true,
  messageRemerciement: "Merci pour votre confiance.",
};

export interface ParametresBonLivraison {
  afficherMentionsLegales: boolean;
  labelSignataireDroite: string;
}

export const DEFAUTS_BON_LIVRAISON: ParametresBonLivraison = {
  afficherMentionsLegales: true,
  labelSignataireDroite: "EVOLUTIS223",
};

export interface ParametresFichePaie {
  afficherMentionsLegales: boolean;
  labelSignataire: string;
}

export const DEFAUTS_FICHE_PAIE: ParametresFichePaie = {
  afficherMentionsLegales: true,
  labelSignataire: "L'employé(e)",
};

async function chargerConfig(type: TypeDocument): Promise<Record<string, unknown> | null> {
  const [row] = await db
    .select({ config: parametresDocuments.config })
    .from(parametresDocuments)
    .where(eq(parametresDocuments.typeDocument, type))
    .limit(1);
  return (row?.config as Record<string, unknown> | undefined) ?? null;
}

export async function chargerParametresRecuCaisse(): Promise<ParametresRecuCaisse> {
  const config = await chargerConfig("RECU_CAISSE");
  return { ...DEFAUTS_RECU_CAISSE, ...config };
}

export async function chargerParametresBonLivraison(): Promise<ParametresBonLivraison> {
  const config = await chargerConfig("BON_LIVRAISON");
  return { ...DEFAUTS_BON_LIVRAISON, ...config };
}

export async function chargerParametresFichePaie(): Promise<ParametresFichePaie> {
  const config = await chargerConfig("FICHE_PAIE");
  return { ...DEFAUTS_FICHE_PAIE, ...config };
}

export async function enregistrerParametresDocument(
  type: TypeDocument,
  config: Record<string, unknown>,
  modifiePar: number
): Promise<void> {
  const [existing] = await db
    .select({ id: parametresDocuments.id })
    .from(parametresDocuments)
    .where(eq(parametresDocuments.typeDocument, type))
    .limit(1);
  if (existing) {
    await db
      .update(parametresDocuments)
      .set({ config, modifiePar, dateModification: new Date() })
      .where(eq(parametresDocuments.id, existing.id));
  } else {
    await db.insert(parametresDocuments).values({ typeDocument: type, config, modifiePar });
  }
}
