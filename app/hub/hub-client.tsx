"use client";

import { useRouter } from "next/navigation";
import { logout } from "@/app/actions";

// Page-seuil après connexion — pas la barre de modules interne (AppShell), volontairement : c'est
// un choix de destination, pas un écran de travail. Structuré en liste de "portes" pour accueillir
// facilement des chemins filtrés par rôle plus tard (§ décision utilisateur 2026-08-04) sans
// réécrire la page — pour l'instant, seules Boutique et Travail sont ouvertes à tous.
const PORTES = [
  {
    key: "boutique",
    href: "/boutique",
    titre: "La Boutique",
    sousTitre: "La vitrine en ligne EVOLUTIS223 — catalogue, prix, disponibilité réelle.",
    accent: "38,74%,58%", // or chaud
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 9.5 4.8 4h14.4l1.3 5.5" />
        <path d="M3.5 9.5a2.3 2.3 0 0 0 4.6.4 2.3 2.3 0 0 0 4.5 0 2.3 2.3 0 0 0 4.5 0 2.3 2.3 0 0 0 4.6-.4" />
        <path d="M5 10v9.5h14V10" />
        <path d="M9.5 19.5V14h5v5.5" />
      </svg>
    ),
  },
  {
    key: "travail",
    href: "/",
    titre: "Au Travail",
    sousTitre: "Affaires, stocks, RH, trésorerie — l'espace de gestion interne.",
    accent: "212,60%,60%", // bleu graphite
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="8" width="17" height="12" rx="1.4" />
        <path d="M8.5 8V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" />
        <path d="M3.5 13h17" />
        <path d="M10.5 13v2h3v-2" />
      </svg>
    ),
  },
] as const;

export function HubClient({ userName, roleLibelle }: { userName: string; roleLibelle: string }) {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(59,130,246,0.10), transparent), #08090c",
        color: "#e7e7ea",
        fontFamily: "var(--font-geist-sans, system-ui), -apple-system, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 32px" }}>
        <div style={{ fontSize: 13, letterSpacing: "0.28em", color: "#5b6472", fontWeight: 600 }}>EVOLUTIS223</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ textAlign: "right", lineHeight: 1.25 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e7e7ea" }}>{userName}</div>
            <div style={{ fontSize: 10.5, color: "#6b7280" }}>{roleLibelle}</div>
          </div>
          <button
            onClick={() => logout()}
            title="Changer de profil"
            style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", color: "#9ca9bb", borderRadius: 20, width: 32, height: 32, fontSize: 13, cursor: "pointer" }}
          >
            ⎋
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 24px 64px" }}>
        <div style={{ fontSize: 24, fontWeight: 600, color: "#f5f6f8", marginBottom: 44, textAlign: "center" }}>
          Où allez-vous ?
        </div>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center", maxWidth: 760, width: "100%" }}>
          {PORTES.map((p) => (
            <button
              key={p.key}
              onClick={() => router.push(p.href)}
              style={{
                flex: "1 1 320px",
                maxWidth: 360,
                textAlign: "left",
                cursor: "pointer",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 18,
                padding: "30px 26px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
                transition: "border-color .2s, background .2s, transform .2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `hsla(${p.accent},0.55)`;
                e.currentTarget.style.background = "rgba(255,255,255,0.055)";
                e.currentTarget.style.transform = "translateY(-3px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                e.currentTarget.style.transform = "none";
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: `hsl(${p.accent})`,
                  background: `hsla(${p.accent},0.12)`,
                  border: `1px solid hsla(${p.accent},0.3)`,
                }}
              >
                {p.icon}
              </div>
              <div>
                <div style={{ fontSize: 19, fontWeight: 600, color: "#f5f6f8", marginBottom: 6 }}>{p.titre}</div>
                <div style={{ fontSize: 13, color: "#8b93a1", lineHeight: 1.5 }}>{p.sousTitre}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
