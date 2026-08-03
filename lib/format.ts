// Formateur de devise partagé par tous les écrans client (§ décision utilisateur 2026-08-03 :
// devise textuelle "FCFA" partout, zéro exception, zéro abréviation "F").
const NOMBRE_FR = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function formatFcfa(montant: number | string): string {
  return `${NOMBRE_FR.format(Math.round(Number(montant)))} FCFA`;
}

/** Juste le nombre, sans l'unité — pour les gros totaux où "FCFA" s'affiche séparément, en plus petit. */
export function formatNombre(montant: number | string): string {
  return NOMBRE_FR.format(Math.round(Number(montant)));
}
