"use client";

import { useEffect } from "react";

// Enregistrement minimal — juste pour satisfaire les critères d'installabilité de certains
// navigateurs (§3.2). Ne met rien en cache lui-même : le tampon hors ligne du poste comptoir
// (§3.3) vit dans localStorage, pas dans ce service worker, pour rester simple à vérifier.
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
