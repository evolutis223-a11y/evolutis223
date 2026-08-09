// Commentaires conditionnels partagés entre le PDF (rapport-document.tsx, rendu serveur via
// @react-pdf/renderer) et l'aperçu HTML côté client (components/documents/rapport-preview.tsx).
// Fichier volontairement sans dépendance à @react-pdf/renderer pour rester importable côté client.

import { formatFcfa } from "./format";
import type { RapportDocumentData } from "./types";

export function commentaireFinance(f: RapportDocumentData["finance"]): string {
  if (f.beneficeNet < 0) {
    return `La période affiche un résultat net négatif de ${formatFcfa(Math.abs(f.beneficeNet))} : les achats, charges et commissions ont dépassé le chiffre d'affaires réalisé.`;
  }
  if (f.variationBeneficeNetPct !== null && f.variationBeneficeNetPct >= 10) {
    return `Le bénéfice net progresse de ${f.variationBeneficeNetPct}% par rapport à la période précédente, une évolution favorable.`;
  }
  if (f.variationBeneficeNetPct !== null && f.variationBeneficeNetPct <= -10) {
    return `Le bénéfice net recule de ${Math.abs(f.variationBeneficeNetPct)}% par rapport à la période précédente — à surveiller.`;
  }
  return `Le résultat net de la période est positif et globalement stable par rapport à la période précédente.`;
}

export function commentaireOperations(o: RapportDocumentData["operations"]): string {
  if (o.ruptureActuelle === 0) return "Aucune rupture de stock n'est constatée à la date d'émission de ce rapport.";
  if (o.ruptureActuelle <= 2) return `${o.ruptureActuelle} article(s) sont actuellement en rupture de stock — point de vigilance.`;
  return `${o.ruptureActuelle} articles sont actuellement en rupture de stock — un réapprovisionnement rapide est recommandé.`;
}
