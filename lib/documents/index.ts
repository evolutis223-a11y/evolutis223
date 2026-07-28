// Point d'entrée du module de génération PDF (§8.4 / §13 du cahier des charges).
// Un seul type de document est implémenté pour l'instant : le Reçu de caisse (A5
// paysage). Les 5 autres modèles (Bon de commande, Bon de livraison, Fiche de paie,
// Ordre de mission, Courrier) suivront le même pattern une fois celui-ci validé.

export { generateRecuCaissePdf, RecuCaisseDocument } from "./recu-caisse";
export { ENTREPRISE, MENTIONS_LEGALES_TEXTE } from "./legal-mentions";
export { sha256Hex } from "./hash";
export { formatFcfa, formatDateHeure } from "./format";
export type { RecuCaisseData, LigneRecu, ModeReglement, DocumentGenere } from "./types";
