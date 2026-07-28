// Petits formatteurs partagés par les générateurs PDF (montants FCFA, dates fr-FR).

const NOMBRE_FR = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** Formate un montant en Francs CFA, ex 12500 -> "12 500 F". */
export function formatFcfa(montant: number): string {
  return `${NOMBRE_FR.format(Math.round(montant))} F`;
}

/** Formate une date en "JJ/MM/AAAA HH:mm" (fuseau local du serveur). */
export function formatDateHeure(date: Date): string {
  const jj = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const aaaa = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${jj}/${mm}/${aaaa} ${hh}:${min}`;
}
