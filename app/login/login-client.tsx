"use client";

import type { ReactNode } from "react";
import { useActionState, useState } from "react";
import { login, loginDirect, type LoginState } from "./actions";

type RosterEntry = { nom: string; telephone: string; roleLibelle: string; roleCode: string };

const initialState: LoginState = { error: null };

// Icône + teinte par rôle (pas par personne) — reconnaissance immédiate au clic pendant la
// période de vérification (§ décision utilisateur 2026-08-04), sans avoir à lire les noms.
const ROLE_HUES: Record<string, number> = {
  SUPER_ADMIN: 265,
  ADMIN: 210,
  MANAGER: 190,
  COMPTABLE: 150,
  RESP_COMMERCIAL: 35,
  AGENT_MARKETING: 320,
  COMMERCIAL: 35,
  VENDEUR: 20,
  FREELANCE: 8,
  EMPLOYE: 200,
  SUPPORT: 170,
  LIVREUR: 20,
  LIVREUR_PARTENAIRE: 20,
};

function stroke(children: ReactNode) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const ROLE_ICONS: Record<string, ReactNode> = {
  SUPER_ADMIN: stroke(<><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></>),
  ADMIN: stroke(<><circle cx="12" cy="12" r="3" /><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.5h-4l-.3 2.6a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.3 2.6h4l.3-2.6a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5z" /></>),
  MANAGER: stroke(<><rect x="3.5" y="8" width="17" height="12" rx="1.4" /><path d="M8.5 8V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" /></>),
  COMPTABLE: stroke(<><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 8h8M8 12h2M12.5 12h2M17 12h.01M8 16h2M12.5 16h2M17 16h.01" /></>),
  RESP_COMMERCIAL: stroke(<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></>),
  AGENT_MARKETING: stroke(<><path d="M3 10v4h3l6 4V6L6 10H3z" /><path d="M15 9a4 4 0 0 1 0 6" /><path d="M18 6.5a8 8 0 0 1 0 11" /></>),
  COMMERCIAL: stroke(<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></>),
  VENDEUR: stroke(<><path d="M5 8h14l-1.3 10.4a1.6 1.6 0 0 1-1.6 1.4H7.9a1.6 1.6 0 0 1-1.6-1.4L5 8z" /><path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2" /></>),
  FREELANCE: stroke(<><rect x="3" y="5" width="18" height="12" rx="1.3" /><path d="M3 17h18" /><path d="M9.5 20.5h5" /></>),
  EMPLOYE: stroke(<><circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" /></>),
  SUPPORT: stroke(<><path d="M4 13v-1a8 8 0 0 1 16 0v1" /><rect x="2.5" y="13" width="4" height="6" rx="1.4" /><rect x="17.5" y="13" width="4" height="6" rx="1.4" /><path d="M20 19a4 4 0 0 1-4 3h-2" /></>),
  LIVREUR: stroke(<><rect x="2.5" y="7" width="11" height="9" rx="1" /><path d="M13.5 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>),
  LIVREUR_PARTENAIRE: stroke(<><rect x="2.5" y="7" width="11" height="9" rx="1" /><path d="M13.5 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>),
};
const DEFAULT_ICON = stroke(<><circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" /></>);

export function LoginClient({ roster }: { roster: RosterEntry[] }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [modeManuel, setModeManuel] = useState(false);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(59,130,246,0.10), transparent), #08090c",
        color: "#e7e7ea",
        fontFamily: "var(--font-geist-sans, system-ui), -apple-system, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 44 }}>
        <div style={{ fontSize: 13, letterSpacing: "0.28em", color: "#5b6472", fontWeight: 600, marginBottom: 10 }}>
          EVOLUTIS223
        </div>
        <div style={{ fontSize: 26, fontWeight: 600, color: "#f5f6f8", letterSpacing: "-0.01em" }}>
          Choisissez votre profil
        </div>
        <div style={{ fontSize: 13.5, color: "#6b7280", marginTop: 8 }}>
          Espace de travail interne — accès réservé au personnel
        </div>
      </div>

      {!modeManuel && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))",
              gap: 14,
              width: "100%",
              maxWidth: 780,
            }}
          >
            {roster.map((u) => {
              const hue = ROLE_HUES[u.roleCode] ?? 210;
              const icon = ROLE_ICONS[u.roleCode] ?? DEFAULT_ICON;
              return (
                <form key={u.telephone} action={loginDirect.bind(null, u.telephone)}>
                  <button
                    type="submit"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 14,
                      padding: "20px 16px",
                      transition: "border-color .18s, background .18s, transform .18s",
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = `hsla(${hue},70%,62%,0.55)`;
                      e.currentTarget.style.background = "rgba(255,255,255,0.055)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                      e.currentTarget.style.transform = "none";
                    }}
                  >
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: `hsl(${hue},70%,78%)`,
                        background: `hsla(${hue},70%,55%,0.14)`,
                        border: `1px solid hsla(${hue},70%,62%,0.35)`,
                      }}
                    >
                      {icon}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600, color: "#f0f1f3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.nom}
                      </div>
                      <div style={{ fontSize: 11.5, color: "#7a8290", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {u.roleLibelle}
                      </div>
                    </div>
                  </button>
                </form>
              );
            })}
          </div>

          <div style={{ marginTop: 36, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setModeManuel(true)}
              style={{ background: "none", border: "none", color: "#5b6472", fontSize: 12.5, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              Se connecter avec téléphone et PIN
            </button>
            <a href="/rejoindre" style={{ fontSize: 13, color: "#8ea8f2", textDecoration: "none" }}>
              Rejoignez-nous →
            </a>
          </div>
        </>
      )}

      {modeManuel && (
        <form
          action={formAction}
          style={{
            width: "100%",
            maxWidth: 340,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            padding: 28,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div>
            <label htmlFor="telephone" style={{ fontSize: 12, color: "#8b93a1" }}>
              Téléphone
            </label>
            <input
              id="telephone"
              name="telephone"
              type="tel"
              autoComplete="tel"
              placeholder="+223 00 00 00 00"
              required
              style={{ marginTop: 6, width: "100%", background: "#101216", border: "1px solid rgba(255,255,255,0.1)", color: "#f0f1f3", padding: "10px 12px", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label htmlFor="pin" style={{ fontSize: 12, color: "#8b93a1" }}>
              PIN
            </label>
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              required
              style={{ marginTop: 6, width: "100%", background: "#101216", border: "1px solid rgba(255,255,255,0.1)", color: "#f0f1f3", padding: "10px 12px", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
          {state.error && (
            <p style={{ fontSize: 12.5, color: "#f87171" }} role="alert">
              {state.error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            style={{ background: "#3b82f6", color: "#fff", border: "none", padding: "11px 14px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            {pending ? "Connexion..." : "Se connecter"}
          </button>
          <button
            type="button"
            onClick={() => setModeManuel(false)}
            style={{ background: "none", border: "none", color: "#5b6472", fontSize: 12.5, cursor: "pointer" }}
          >
            ← Retour aux profils
          </button>
        </form>
      )}
    </main>
  );
}
