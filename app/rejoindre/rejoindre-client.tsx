"use client";

import { useActionState, type CSSProperties } from "react";
import { demanderAcces, type DemandeAccesState } from "./actions";

const initialState: DemandeAccesState = { error: null };

export function RejoindreClient() {
  const [state, formAction, pending] = useActionState(demanderAcces, initialState);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(59,130,246,0.10), transparent), #08090c",
        color: "#e7e7ea",
        fontFamily: "var(--font-geist-sans, system-ui), -apple-system, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 13, letterSpacing: "0.28em", color: "#5b6472", fontWeight: 600, marginBottom: 10 }}>
            EVOLUTIS223
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: "#f5f6f8" }}>Rejoignez-nous</div>
        </div>

        {state.success ? (
          <div
            style={{
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.35)",
              borderRadius: 14,
              padding: 24,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 14.5, color: "#d1f5e6", fontWeight: 600, marginBottom: 6 }}>
              Demande envoyée.
            </div>
            <div style={{ fontSize: 13, color: "#9ca9bb" }}>
              Vous serez averti dès que votre accès sera validé.
            </div>
          </div>
        ) : (
          <form
            action={formAction}
            style={{
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
              <label htmlFor="nom" style={{ fontSize: 12, color: "#8b93a1" }}>
                Nom complet
              </label>
              <input
                id="nom"
                name="nom"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="telephone" style={{ fontSize: 12, color: "#8b93a1" }}>
                Téléphone
              </label>
              <input id="telephone" name="telephone" type="tel" placeholder="+223 00 00 00 00" required style={inputStyle} />
            </div>
            <div>
              <label htmlFor="posteVise" style={{ fontSize: 12, color: "#8b93a1" }}>
                Poste visé (facultatif)
              </label>
              <input id="posteVise" name="posteVise" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="pin" style={{ fontSize: 12, color: "#8b93a1" }}>
                Choisissez un PIN (4 à 8 chiffres)
              </label>
              <input id="pin" name="pin" type="password" inputMode="numeric" required style={inputStyle} />
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
              {pending ? "Envoi..." : "Envoyer ma demande"}
            </button>
            <a href="/login" style={{ fontSize: 12.5, color: "#5b6472", textAlign: "center" }}>
              ← Déjà du personnel ? Se connecter
            </a>
          </form>
        )}
      </div>
    </main>
  );
}

const inputStyle: CSSProperties = {
  marginTop: 6,
  width: "100%",
  background: "#101216",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#f0f1f3",
  padding: "10px 12px",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box",
};
