// §3.3/§10 — calcul de prix du configurateur, chemin court et chemin long. Décision utilisateur
// 2026-07-31 : sur une commande à plusieurs tailles/quantités, le coût de zone (§10bis, cadre
// sérigraphie compris) et les finitions se multiplient tous par la quantité totale — pas de
// distinction "mise en place one-time" pour cette passe, cohérence/simplicité choisies par lui.

import { calculerCoutZone, type Bibliotheque, type ZoneConfig } from "@/lib/calculateurs/marquage";

export interface FinitionSelection {
  id: number;
  nom: string;
  montant: number;
}

export interface CalculCheminLongInput {
  prixArticle: number;
  zones: ZoneConfig[];
  finitions: FinitionSelection[];
  quantiteTotale: number;
}

export interface CalculCheminLongResult {
  zoneResultats: { zoneId: string; montant: number; detailLabel: string }[];
  prixUnitaireBase: number;
  prixUnitaireZones: number;
  prixUnitaireFinitions: number;
  prixUnitaireTotal: number;
  total: number;
}

export function calculerCheminLong(input: CalculCheminLongInput, biblio: Bibliotheque): CalculCheminLongResult {
  const zoneResultats = input.zones.map((z) => {
    const r = calculerCoutZone(z, biblio);
    return { zoneId: z.id, montant: r.montant, detailLabel: r.detailLabel };
  });
  const prixUnitaireZones = zoneResultats.reduce((acc, z) => acc + z.montant, 0);
  const prixUnitaireFinitions = input.finitions.reduce((acc, f) => acc + f.montant, 0);
  const prixUnitaireTotal = input.prixArticle + prixUnitaireZones + prixUnitaireFinitions;
  return {
    zoneResultats,
    prixUnitaireBase: input.prixArticle,
    prixUnitaireZones,
    prixUnitaireFinitions,
    prixUnitaireTotal,
    total: prixUnitaireTotal * input.quantiteTotale,
  };
}

export function calculerCheminCourt(prixDepart: number, quantiteTotale: number): number {
  return prixDepart * quantiteTotale;
}
