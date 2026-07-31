// Stockage fichiers — Vercel Blob (§3.2, tranché 2026-07-30). Utilitaire serveur unique pour
// tout le projet : logos/modèles uploadés côté parcours maquette public (§10ter) pour l'instant,
// réutilisable ailleurs (configurateur §10) une fois construit.

import { put } from "@vercel/blob";

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 Mo — large pour couvrir les fichiers de production (§13 guide technique)
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

export interface UploadResult {
  url: string;
}

/**
 * Upload un fichier reçu d'un <input type=file> (FormData) vers Vercel Blob et retourne son URL
 * publique. `prefix` organise les fichiers par usage (ex. "maquette-logos", "maquette-modeles").
 */
export async function uploadFichier(file: File, prefix: string): Promise<UploadResult> {
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(`Fichier trop volumineux (max ${MAX_SIZE_BYTES / 1024 / 1024} Mo).`);
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Type de fichier non accepté (JPEG, PNG, WebP ou SVG uniquement).");
  }
  const ext = file.name.split(".").pop() || "bin";
  const nomUnique = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const blob = await put(nomUnique, file, { access: "public" });
  return { url: blob.url };
}
