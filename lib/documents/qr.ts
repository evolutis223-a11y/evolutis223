// Génération de QR code pour les documents imprimables (§11, §13 du cahier des charges).
// `qrcode` est pur JS (aucun binaire natif) — cohérent avec le reste de lib/documents/.
// Portée exacte du contenu du QR pas encore tranchée (§16.7 mineur) : pour l'instant on encode
// juste un identifiant de suivi provisoire ; la vraie page de suivi public (§11) n'existe pas
// encore, ce payload sera à revoir une fois le nom de domaine et cette page définis.

import QRCode from "qrcode";

export async function generateQrPngDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { margin: 1, width: 160 });
}

export function suiviPayloadProvisoire(numero: string): string {
  return `EVOLUTIS223-SUIVI:${numero}`;
}
