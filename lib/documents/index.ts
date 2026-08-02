// Point d'entrée du module de génération PDF (§8.4 / §13 du cahier des charges).
// Deux modèles implémentés : Reçu de caisse (A5 paysage) et Bon de livraison (A4).
// Les 4 autres (Bon de commande, Fiche de paie, Ordre de mission, Courrier) suivront le
// même pattern quand les modules dont ils dépendent (Achats/Fournisseurs, RH — Phase 4)
// existeront réellement en base — pas de générateur sans données réelles à mapper.

export { generateRecuCaissePdf, RecuCaisseDocument } from "./recu-caisse";
export { generateBonLivraisonPdf, BonLivraisonDocument } from "./bon-livraison";
export { generateFichePaiePdf, FichePaieDocument } from "./fiche-paie";
export { ENTREPRISE, MENTIONS_LEGALES_TEXTE } from "./legal-mentions";
export { sha256Hex } from "./hash";
export { formatFcfa, formatDateHeure } from "./format";
export {
  chargerParametresRecuCaisse,
  chargerParametresBonLivraison,
  chargerParametresFichePaie,
  enregistrerParametresDocument,
  DEFAUTS_RECU_CAISSE,
  DEFAUTS_BON_LIVRAISON,
  DEFAUTS_FICHE_PAIE,
  type TypeDocument,
  type ParametresRecuCaisse,
  type ParametresBonLivraison,
  type ParametresFichePaie,
} from "./parametres";
export type {
  RecuCaisseData,
  LigneRecu,
  ModeReglement,
  BonLivraisonData,
  LigneBonLivraison,
  FichePaieData,
  RubriquePaie,
  DocumentGenere,
} from "./types";
