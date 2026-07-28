// Répartition de la réserve détail au prorata des tailles — méthode du plus grand reste
// (Hare/largest remainder). Résout CAHIER_DES_CHARGES.md §16.8.
//
// Pour chaque taille : part = floor(reserveTotale * produitTaille / produitTotal).
// Le reliquat (reserveTotale - somme des parts) est distribué une unité à la fois aux
// tailles ayant le plus grand reste fractionnaire — jamais de dépassement, jamais négatif.

export function repartirReserveAuProrata(
  produitParTaille: Record<string, number>,
  reserveTotale: number
): Record<string, number> {
  const tailles = Object.keys(produitParTaille).filter((t) => produitParTaille[t] > 0);
  const produitTotal = tailles.reduce((acc, t) => acc + produitParTaille[t], 0);

  const parts: Record<string, number> = {};
  const restes: { taille: string; reste: number }[] = [];

  if (produitTotal <= 0 || reserveTotale <= 0) {
    for (const t of tailles) parts[t] = 0;
    return parts;
  }

  let distribue = 0;
  for (const t of tailles) {
    const exact = (reserveTotale * produitParTaille[t]) / produitTotal;
    const part = Math.floor(exact);
    parts[t] = part;
    distribue += part;
    restes.push({ taille: t, reste: exact - part });
  }

  let reliquat = reserveTotale - distribue;
  restes.sort((a, b) => b.reste - a.reste);
  for (let i = 0; i < restes.length && reliquat > 0; i++, reliquat--) {
    parts[restes[i].taille] += 1;
  }

  return parts;
}
