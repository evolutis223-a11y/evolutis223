// Hash d'intégrité des PDF générés — module `crypto` natif de Node, aucune dépendance
// supplémentaire. Utilisé pour remplir documentsArchives.hashIntegrite (§4.9) : garantit
// que le fichier archivé n'a pas été modifié après émission (§8.4.4, immuabilité).

import { createHash } from "node:crypto";

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
