// Métadonnées des 5 familles d'articles (§5) — partagées par la page et les composants clients.

export type FamilleId = "A" | "B" | "C" | "D" | "E";

export interface FamilleMeta {
  id: FamilleId;
  label: string;
  short: string;
  desc: string;
  guidance: string;
  badgeClass: string;
  tileClass: string;
}

export const FAMILLES: FamilleMeta[] = [
  {
    id: "A",
    label: "Textile / douzaine",
    short: "Douzaine",
    desc: "Polo, T-shirt — appro en douzaines + réserve.",
    guidance:
      "Après création : renseignez l'approvisionnement (douzaines, répartition par taille, réserve détail) dans Stocks. Chaque variante (taille/couleur) devient une ligne de stock distincte.",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    tileClass: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
  },
  {
    id: "B",
    label: "Unité simple",
    short: "Unité",
    desc: "Mug, stylo — pas de taille/couleur.",
    guidance:
      "Une seule ligne de stock est créée automatiquement (variante par défaut). Renseignez la quantité initiale et le seuil d'alerte dans Stocks.",
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    tileClass: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300",
  },
  {
    id: "C",
    label: "Service sans stock",
    short: "Service",
    desc: "Relooking, reportage — aucun stock.",
    guidance:
      "Aucune quantité à suivre — l'article est toujours vendable. Une vente crée une entrée dans Agenda/Commandes plutôt qu'un mouvement de stock.",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    tileClass: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300",
  },
  {
    id: "D",
    label: "Fabrication sur commande",
    short: "Sur commande",
    desc: "Signalétique, impression grand format.",
    guidance:
      "Pas de stock de produit fini. Chaque vente déclenche automatiquement un Ordre de Fabrication (Conception → Production → Contrôle → Livraison/Retrait).",
    badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
    tileClass: "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300",
  },
  {
    id: "E",
    label: "Produit composé / Kit",
    short: "Kit",
    desc: "Assemble des articles existants.",
    guidance:
      "Aucune quantité ne se saisit ici. Après création, définissez la recette (composants + variante exacte requise) — le stock du kit sera calculé automatiquement.",
    badgeClass: "bg-secondary text-secondary-foreground",
    tileClass: "bg-secondary text-secondary-foreground",
  },
];

export function familleMeta(id: string): FamilleMeta {
  return FAMILLES.find((f) => f.id === id) ?? FAMILLES[0];
}

export function FamilleIcon({ id, className }: { id: FamilleId; className?: string }) {
  switch (id) {
    case "A":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
          <path d="M8 3 4 6l2 3h1v11h10V9h1l2-3-4-3-2 2h-4L8 3Z" />
        </svg>
      );
    case "B":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
          <path d="M5 5h11v9a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V5Z" />
          <path d="M16 8h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-2" />
        </svg>
      );
    case "C":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
          <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
      );
    case "D":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
          <rect x="3" y="4" width="18" height="11" rx="1.5" />
          <path d="M12 15v5M9 20h6" />
        </svg>
      );
    case "E":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
          <path d="M12 3 4 7l8 4 8-4-8-4Z" />
          <path d="M4 7v10l8 4 8-4V7" />
          <path d="M12 11v10" />
        </svg>
      );
  }
}
