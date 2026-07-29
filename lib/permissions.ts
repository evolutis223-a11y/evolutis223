// Cartographie provisoire rôle -> modules visibles (CAHIER_DES_CHARGES.md §6, §7).
// Squelette pour le garde de navigation Phase 0 — la matrice fine (droits nominatifs, droits
// temporaires) reste à construire en Phase 1/2, pas encore modélisée en base ici.

export const ALL_MODULES = [
  "Tableau de bord",
  "Affaires",
  "Clients",
  "Catalogue",
  "Nos produits",
  "Marketing",
  "R&D",
  "Stocks",
  "Production",
  "Commandes",
  "Règlements",
  "Documents",
  "RH",
  "Commercial",
  "Fournisseurs",
  "Achats",
  "Dépenses",
  "Charges",
  "Trésorerie",
  "Rapports",
  "Paramètres",
] as const;

export type ModuleName = (typeof ALL_MODULES)[number];

export const ROLE_MODULES: Record<string, readonly ModuleName[]> = {
  SUPER_ADMIN: ALL_MODULES,
  ADMIN: ALL_MODULES.filter((m) => m !== "Paramètres"),
  MANAGER: [
    "Tableau de bord",
    "Affaires",
    "Clients",
    "Catalogue",
    "R&D",
    "Stocks",
    "Production",
    "Commandes",
    "Règlements",
    "Documents",
    "Rapports",
  ],
  COMPTABLE: [
    "Tableau de bord",
    "Règlements",
    "Achats",
    "Dépenses",
    "Charges",
    "Trésorerie",
    "Rapports",
  ],
  RESP_COMMERCIAL: ["Tableau de bord", "Affaires", "Clients", "Commercial", "Rapports"],
  COMMERCIAL: ["Tableau de bord", "Affaires", "Clients", "Catalogue", "Commercial"],
  VENDEUR: ["Tableau de bord", "Affaires", "Catalogue", "R&D", "Commandes"],
  FREELANCE: ["Tableau de bord", "Commercial"],
  JOURNALIER: [], // pas de compte applicatif (§6) — présent pour complétude, jamais connecté
  EMPLOYE: ["Tableau de bord", "Stocks", "Production", "Commandes"],
  SUPPORT: ["Tableau de bord", "Documents"],
  LIVREUR: ["Tableau de bord", "Commandes"],
  LIVREUR_PARTENAIRE: ["Tableau de bord", "Commandes"],
};

export function modulesForRole(roleCode: string): readonly ModuleName[] {
  return ROLE_MODULES[roleCode] ?? [];
}

export function hasModuleAccess(roleCode: string, module: ModuleName): boolean {
  return modulesForRole(roleCode).includes(module);
}
