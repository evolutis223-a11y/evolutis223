// Types de données partagés par les générateurs PDF de lib/documents/.
// Volontairement "objets de données simples" (pas de dépendance à Drizzle/db ici) :
// c'est à l'appelant (app/actions.ts, routes API, etc.) de charger les données depuis
// la base et de les mapper vers ces formes avant d'appeler un générateur.

export type ModeReglement = "ESPECES" | "MOBILE_MONEY" | "VIREMENT" | "CARTE";

export interface LigneRecu {
  designation: string;
  quantite: number;
  prixUnitaire: number;
  /** Total de la ligne (qté × prix unitaire), déjà calculé par l'appelant. */
  total: number;
}

export interface RecuCaisseData {
  /** Numéro de reçu, ex "REC-26-0001". */
  numero: string;
  /** Date/heure d'émission ; défaut = maintenant. */
  dateEmission?: Date;
  lignes: LigneRecu[];
  modeReglement: ModeReglement;
  /** Nom de la personne ayant encaissé. */
  recuPar: string;
  /** Sous-total HT ; si omis, calculé comme la somme des lignes. */
  sousTotalHt?: number;
  remise?: number;
  tva?: number;
  /** Total TTC dû par le client. */
  totalTtc: number;
  /** Montant effectivement remis par le client. */
  montantRecu: number;
  /** Reliquat dû au client ; si omis, calculé = montantRecu - totalTtc (borné à 0 si négatif). */
  reliquat?: number;
  /** Contenu encodé dans le QR (§11) ; si omis, dérivé de `numero` (voir qr.ts). */
  qrPayload?: string;
}

/** Résultat commun à tous les générateurs : le PDF et son empreinte d'intégrité. */
export interface DocumentGenere {
  buffer: Buffer;
  /** SHA-256 hex du buffer PDF — destiné à documentsArchives.hashIntegrite (§4.9). */
  hashSha256: string;
}

export interface LigneBonLivraison {
  designation: string;
  quantiteCommandee: number;
  quantiteLivree: number;
}

export interface BonLivraisonData {
  /** Numéro du bon lui-même, ex "BL-26-0001" (§13 — espace de numérotation propre au document imprimé,
   * distinct du numéro de l'affaire qu'il documente). */
  numero: string;
  dateEmission?: Date;
  /** Numéro de l'affaire liée (Commande, §8.1), ex "CDE-26-0002". */
  affaireNumero: string;
  objet: string;
  clientNom: string;
  clientContact?: string;
  /** Canal/mode de finalisation affiché en badge (§8.1 — Retrait boutique ou Livraison). */
  canal: string;
  lignes: LigneBonLivraison[];
  remarques?: string;
  qrPayload?: string;
}
