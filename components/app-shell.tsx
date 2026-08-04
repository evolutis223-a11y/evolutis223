"use client";

// Reproduction fidèle de la structure de navigation de design/Application de Gestion
// EVOLUTIS223.dc.html (barre de modules persistante + bandeau) — pas une réinterprétation.
// Icônes, couleurs et ordre des modules copiés depuis ce fichier (lignes ~71-148, ~9144-9177).

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { logout } from "@/app/actions";

type IconKey =
  | "superadmin" | "dashboard" | "affaires" | "clients" | "catalogue" | "produits" | "marketing"
  | "rd" | "stock" | "livraisons" | "reglements" | "documents" | "rh" | "commercial" | "fournisseurs"
  | "achats" | "depenses" | "charges" | "tresorerie" | "rapports" | "parametres";

const ICONS: Record<IconKey, ReactNode> = {
  superadmin: <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z M9 12l2 2 4-4" />,
  dashboard: <><path d="M4 13a8 8 0 0 1 16 0" /><path d="M12 13l3.5-4" /><circle cx="12" cy="13" r="0.9" fill="currentColor" stroke="none" /></>,
  affaires: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v3h3" /><path d="M9 12h6M9 15h6M9 9h3" /></>,
  clients: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" /><circle cx="17" cy="8.5" r="2.4" /><path d="M15.5 13.6c2.3.3 4 2.2 4 4.9" /></>,
  catalogue: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.2" /></>,
  produits: <><path d="M11 3l8 8-8 8-8-8V3h8z" /><circle cx="8" cy="7" r="1" fill="currentColor" stroke="none" /></>,
  marketing: <><path d="M3 10v4h3l6 4V6L6 10H3z" /><path d="M15 9a4 4 0 0 1 0 6" /><path d="M18 6.5a8 8 0 0 1 0 11" /></>,
  rd: <><path d="M10 3h4" /><path d="M10.5 3.5v6L6 18a1.5 1.5 0 0 0 1.3 2.3h9.4A1.5 1.5 0 0 0 18 18l-4.5-8.5v-6" /><path d="M8.2 15h7.6" /></>,
  stock: <><path d="M12 3l7.5 4.3v9.4L12 21l-7.5-4.3V7.3L12 3z" /><path d="M4.5 7.3L12 11.6l7.5-4.3M12 11.6V21" /></>,
  livraisons: <><rect x="2.5" y="7" width="11" height="9" rx="1" /><path d="M13.5 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>,
  reglements: <><rect x="2.5" y="6.5" width="19" height="12" rx="2" /><circle cx="12" cy="12.5" r="2.6" /><path d="M2.5 10h2M19.5 15h2" /></>,
  documents: <><path d="M6 2.5h9l4 4v14.5H6z" /><path d="M15 2.5v4h4" /><path d="M9 12h7M9 15.5h7M9 8.5h3" /></>,
  rh: <><circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" /></>,
  commercial: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></>,
  fournisseurs: <><path d="M3 20V11l4.5-3v3L12 8v3l4.5-3v12z" /><path d="M3 20h18" /></>,
  achats: <><path d="M5 8h14l-1.3 10.4a1.6 1.6 0 0 1-1.6 1.4H7.9a1.6 1.6 0 0 1-1.6-1.4L5 8z" /><path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2" /></>,
  depenses: <><path d="M3 6.5h15.5a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5H5a2 2 0 0 1-2-2V6.5z" /><path d="M15.5 12h3" /></>,
  charges: <><path d="M6 2.5h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z" /><path d="M9 8h6M9 12h6" /></>,
  tresorerie: <><path d="M3 9l9-5.5L21 9" /><path d="M4.5 9v9M9 9v9M15 9v9M19.5 9v9" /><path d="M3 20.5h18" /></>,
  rapports: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  parametres: <><circle cx="12" cy="12" r="3" /><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.5h-4l-.3 2.6a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.3 2.6h4l.3-2.6a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5z" /></>,
};

export interface ShellModule {
  key: IconKey;
  label: string;
  href: string;
}

export function AppShell({
  userName,
  roleLibelle,
  pageTitle,
  modules,
  children,
}: {
  userName: string;
  roleLibelle: string;
  pageTitle: string;
  modules: ShellModule[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // Reproduction du garde `canGoBack` de la maquette (pageHistory.length > 0) : notre navigation
  // est du vrai routing Next.js (URLs), pas une pile de pages en mémoire — window.history.length
  // reste à 1 sur un premier chargement direct et augmente dès qu'une navigation a eu lieu.
  const [canGoBack, setCanGoBack] = useState(false);
  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, [pathname]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#121212", color: "#e0e0e0", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}>
      {/* Barre de modules persistante */}
      <div style={{ height: 64, display: "flex", alignItems: "center", gap: 6, padding: "0 14px", overflowX: "auto", background: "#050812", borderBottom: "1px solid #333", flexShrink: 0 }}>
        {modules.map((m) => {
          const active = m.href === "/" ? pathname === "/" : pathname.startsWith(m.href);
          const isSuper = m.key === "superadmin";
          return (
            <button
              key={m.key}
              onClick={() => router.push(m.href)}
              title={m.label}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                border: "none",
                borderRadius: 6,
                color: isSuper ? "#fff" : active ? "#fff" : "#888",
                background: isSuper ? (active ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.05)") : active ? "rgba(59,130,246,0.15)" : "none",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[m.key]}
              </svg>
            </button>
          );
        })}
      </div>

      {/* Bandeau */}
      <div style={{ padding: "10px 18px", background: "#1e1e1e", borderBottom: "1px solid #333", display: "flex", alignItems: "center", gap: 18, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {canGoBack && (
            <button
              onClick={() => router.back()}
              title="Retour"
              style={{ background: "none", border: "1px solid #333", color: "#e0e0e0", borderRadius: 20, width: 34, height: 34, fontSize: 16, cursor: "pointer", flexShrink: 0 }}
            >
              ←
            </button>
          )}
          <button
            onClick={() => router.push("/")}
            title="Accueil"
            style={{ background: "none", border: "1px solid #333", color: "#e0e0e0", borderRadius: 20, width: 34, height: 34, fontSize: 15, cursor: "pointer", flexShrink: 0 }}
          >
            🏠
          </button>
        </div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, color: "#fff" }}>EVOLUTIS223</div>
          <div style={{ color: "#888", fontSize: 12 }}>{pageTitle}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/")} title="Tableau de bord" style={{ background: "none", border: "none", color: "#888", fontSize: 19, cursor: "pointer" }}>
            📊
          </button>
          <button onClick={() => router.push("/affaires?nouveau=1")} title="Nouvelle affaire" style={{ background: "none", border: "none", color: "#888", fontSize: 19, cursor: "pointer" }}>
            ➕
          </button>
          <button onClick={() => router.push("/rapports")} title="Rapports" style={{ background: "none", border: "1px solid #333", color: "#888", fontSize: 12, padding: "5px 10px", borderRadius: 6, cursor: "pointer" }}>
            🖨️ Rapport
          </button>
          <button onClick={() => router.push("/parametres")} title="Paramètres" style={{ background: "none", border: "none", color: "#888", fontSize: 19, cursor: "pointer" }}>
            ⚙️
          </button>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          <input
            placeholder="Rechercher..."
            style={{ background: "#121212", border: "1px solid #333", color: "#e0e0e0", padding: "7px 14px", borderRadius: 20, width: 220, fontSize: 14, boxSizing: "border-box" }}
          />
          <div
            onClick={() => logout()}
            title="Changer de profil"
            style={{ display: "flex", alignItems: "center", gap: 8, background: "#1e1e1e", border: "1px solid #333", borderRadius: 20, padding: "5px 12px 5px 6px", cursor: "pointer" }}
          >
            <span style={{ fontSize: 18 }}>👤</span>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{userName}</div>
              <div style={{ fontSize: 10, color: "#888" }}>{roleLibelle}</div>
            </div>
          </div>
          <form action={logout}>
            <button type="submit" title="Se déconnecter" style={{ background: "none", border: "1px solid #333", color: "#888", borderRadius: 20, width: 34, height: 34, fontSize: 14, cursor: "pointer" }}>
              ⎋
            </button>
          </form>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}
