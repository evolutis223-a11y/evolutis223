import { hasModuleAccess } from "@/lib/permissions";
import type { ShellModule } from "@/components/app-shell";

// Barre de modules — ordre et icônes copiés de design/Application de Gestion
// EVOLUTIS223.dc.html (lignes ~9144-9177). Seuls les modules qui ont une vraie page construite
// apparaissent ici ; voir chaque page.tsx pour la liste "modulesSansEcranDedie" complémentaire.
export function buildShellModules(roleCode: string): ShellModule[] {
  const estAdminOuSuper = roleCode === "ADMIN" || roleCode === "SUPER_ADMIN";
  const barre: (ShellModule | false)[] = [
    estAdminOuSuper && { key: "superadmin", label: "Tour de contrôle", href: "/validations" },
    { key: "dashboard", label: "Tableau de bord", href: "/" },
    hasModuleAccess(roleCode, "Affaires") && { key: "affaires", label: "Affaires", href: "/affaires" },
    hasModuleAccess(roleCode, "Clients") && { key: "clients", label: "Clients", href: "/clients" },
    hasModuleAccess(roleCode, "Catalogue") && { key: "catalogue", label: "Catalogue", href: "/catalogue" },
    hasModuleAccess(roleCode, "Nos produits") && { key: "produits", label: "Nos produits", href: "/boutique" },
    hasModuleAccess(roleCode, "Marketing") && { key: "marketing", label: "Marketing", href: "/marketing" },
    hasModuleAccess(roleCode, "R&D") && { key: "rd", label: "R&D", href: "/rd-calculateurs" },
    hasModuleAccess(roleCode, "Stocks") && { key: "stock", label: "Stocks", href: "/stocks" },
    hasModuleAccess(roleCode, "Commandes") && { key: "livraisons", label: "Commandes", href: "/commandes" },
    hasModuleAccess(roleCode, "Règlements") && { key: "reglements", label: "Règlements", href: "/reglements" },
    hasModuleAccess(roleCode, "Documents") && { key: "documents", label: "Documents", href: "/documents" },
    hasModuleAccess(roleCode, "RH") && { key: "rh", label: "RH", href: "/rh" },
    hasModuleAccess(roleCode, "Commercial") && { key: "commercial", label: "Commercial", href: "/commercial" },
    hasModuleAccess(roleCode, "Fournisseurs") && { key: "fournisseurs", label: "Fournisseurs", href: "/fournisseurs" },
    hasModuleAccess(roleCode, "Achats") && { key: "achats", label: "Achats", href: "/achats" },
    hasModuleAccess(roleCode, "Trésorerie") && { key: "tresorerie", label: "Trésorerie", href: "/tresorerie" },
    hasModuleAccess(roleCode, "Rapports") && { key: "rapports", label: "Rapports", href: "/rapports" },
  ];
  return barre.filter(Boolean) as ShellModule[];
}
