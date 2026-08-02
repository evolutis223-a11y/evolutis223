// Service worker minimal (§3.2) — présent uniquement pour satisfaire les critères
// d'installabilité PWA de certains navigateurs. Ne met rien en cache : chaque requête part au
// réseau normalement. Le tampon hors ligne du poste comptoir (§3.3) est géré séparément, côté
// localStorage (voir app/vente-comptoir/), pas ici — volontairement, pour rester simple à vérifier
// et éviter les bugs classiques de cache figé/périmé d'un service worker plus ambitieux.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Pass-through volontaire — pas de interception/mise en cache.
});
