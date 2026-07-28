// Chargement des assets graphiques partagés (logo, cachet) utilisés par tous les
// générateurs PDF. Les fichiers vivent sous design/assets/ (voir CAHIER_DES_CHARGES.md
// §13). On les lit une fois en mémoire (Buffer) plutôt que de passer un chemin de
// fichier à @react-pdf/renderer : sur Windows, un chemin absolu du type
// "C:\Users\...\logo.png" est mal interprété par le résolveur d'images de la lib
// (url.parse() y voit un protocole "C:"), ce qui fait échouer le chargement en
// silence (tentative de fetch réseau qui échoue). Un Buffer contourne entièrement
// cette logique de résolution d'URL.

import fs from "node:fs";
import path from "node:path";

const ASSETS_DIR = path.join(process.cwd(), "design", "assets");

export const ASSET_BUFFERS = {
  logo: fs.readFileSync(path.join(ASSETS_DIR, "logo.png")),
  cachet: fs.readFileSync(path.join(ASSETS_DIR, "cachet.png")),
} as const;
