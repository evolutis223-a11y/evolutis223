// Bloc de mentions légales communes à tous les documents imprimables EVOLUTIS223.
// Source exacte : CAHIER_DES_CHARGES.md §13 "Documents imprimables et branding".
// Ne pas reformuler / reformater ce texte sans re-vérifier le cahier des charges —
// il reprend mot pour mot les mentions légales attendues sur les 6 modèles.

export const ENTREPRISE = {
  nom: "EVOLUTIS223",
  adresse: "Badalabougou, Rue 90, Porte 307",
  ville: "Bamako/Mali",
  rccm: "MA.BKO.2022.A03394",
  nina: "32209195100049N",
  nif: "085149443X",
  banque: "Banque Atlantique ML135 01016 072750680001 16",
  telephone: "0023 74 74 40 82",
  email: "evolutis223@gmail.com",
} as const;

/**
 * Ligne unique de mentions légales telle qu'affichée en pied de page sur les modèles
 * existants (voir design/Modele Bon Commande.dc.html et les 5 autres modèles).
 */
export const MENTIONS_LEGALES_TEXTE =
  `${ENTREPRISE.adresse} - N°RCCM: ${ENTREPRISE.rccm} - NINA: ${ENTREPRISE.nina} - ` +
  `NIF: ${ENTREPRISE.nif}  BANQUE ATLANTIQUE: ${ENTREPRISE.banque.replace("Banque Atlantique ", "")} - ` +
  `Tel: ${ENTREPRISE.telephone} - Email: ${ENTREPRISE.email}  ${ENTREPRISE.ville}`;
