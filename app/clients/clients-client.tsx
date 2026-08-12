"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AppShell, type ShellModule } from "@/components/app-shell";
import { AideBulle } from "@/components/ui/aide-bulle";
import type { clients } from "@/db/schema";
import { createClient, type CreateClientState } from "./actions";

type Client = typeof clients.$inferSelect;

const initialState: CreateClientState = { error: null };

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#121212",
  border: "1px solid #333",
  color: "#e0e0e0",
  padding: "10px 12px",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box",
};
function darkButton(bg: string, color = "#fff"): React.CSSProperties {
  return { background: bg, color, border: "none", padding: "9px 16px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" };
}

function TypeBadge({ type }: { type: string }) {
  return type === "ONG_CONTRAT" ? (
    <span style={{ borderRadius: 999, background: "rgba(59,130,246,0.15)", color: "#60a5fa", padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>ONG / Contrat</span>
  ) : (
    <span style={{ borderRadius: 999, background: "#333", color: "#ccc", padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>Boutique</span>
  );
}

export function ClientsClient({
  userName,
  roleLibelle,
  modules,
  clients: initialClients,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  clients: Client[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [type, setType] = useState<"BOUTIQUE" | "ONG_CONTRAT">("BOUTIQUE");
  const [search, setSearch] = useState("");
  const [state, action, pending] = useActionState(createClient, initialState);
  const [formKey, setFormKey] = useState(0);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setDrawerOpen(false);
      setFormKey((k) => k + 1);
      setType("BOUTIQUE");
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? initialClients.filter((c) => c.nom.toLowerCase().includes(q) || (c.contact ?? "").toLowerCase().includes(q))
    : initialClients;

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Clients" modules={modules}>
      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Clients</div>
              <AideBulle titre="Comment utiliser Clients">
                <p>
                  <b>Boutique</b> — client comptant, paiement immédiat. Pas de champ contrat à remplir.
                </p>
                <p>
                  <b>ONG / Contrat</b> — paiement différé (ex. 30 jours) avec une référence de contrat. Ce client passe d&apos;abord par une proforma en Commercial avant la facture finale.
                </p>
                <p>La recherche filtre par nom ou par contact au fur et à mesure que tu tapes.</p>
              </AideBulle>
            </div>
            <div style={{ marginTop: 2, fontSize: 12.5, color: "#888" }}>Boutique (client comptant) ou ONG/Contrat (paiement différé, proforma en amont).</div>
          </div>
          <button onClick={() => setDrawerOpen(true)} style={darkButton("#3b82f6")}>
            + Nouveau client
          </button>
        </div>

        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom ou contact..." style={{ ...inputStyle, width: 280, marginBottom: 14 }} />

        <div style={{ border: "1px solid #262626", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ padding: 10, textAlign: "left", color: "#888", fontSize: 11.5, borderBottom: "1px solid #333" }}>Nom</th>
                <th style={{ padding: 10, textAlign: "left", color: "#888", fontSize: 11.5, borderBottom: "1px solid #333" }}>Type</th>
                <th style={{ padding: 10, textAlign: "left", color: "#888", fontSize: 11.5, borderBottom: "1px solid #333" }}>Contact</th>
                <th style={{ padding: 10, textAlign: "left", color: "#888", fontSize: 11.5, borderBottom: "1px solid #333" }}>Contrat</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#666", fontSize: 13 }}>
                    Aucun client.
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td style={{ padding: 10, borderBottom: "1px solid #262626", fontSize: 13, fontWeight: 600, color: "#fff" }}>{c.nom}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #262626" }}>
                    <TypeBadge type={c.typeClient} />
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #262626", fontSize: 12.5, color: "#888" }}>{c.contact ?? "—"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #262626", fontSize: 12.5, color: "#888" }}>
                    {c.contratRef ? `${c.contratRef} (${c.paiementDiffereJours ?? 0} j.)` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drawerOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "flex-end" }} onClick={(e) => e.target === e.currentTarget && setDrawerOpen(false)}>
          <div style={{ width: 420, maxWidth: "92vw", height: "100%", overflowY: "auto", background: "#1e1e1e", borderLeft: "1px solid #333", padding: 24, boxSizing: "border-box" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>Nouveau client</h2>
              <button onClick={() => setDrawerOpen(false)} style={{ background: "none", border: "none", color: "#888", fontSize: 20, cursor: "pointer" }}>
                &times;
              </button>
            </div>

            <form key={formKey} action={action} style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Type</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {(
                    [
                      { id: "BOUTIQUE" as const, label: "Boutique", desc: "Client comptant, paiement immédiat." },
                      { id: "ONG_CONTRAT" as const, label: "ONG / Contrat", desc: "Paiement différé, proforma en amont." },
                    ]
                  ).map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setType(t.id)}
                      style={{ cursor: "pointer", borderRadius: 8, border: `1px solid ${type === t.id ? "#3b82f6" : "#333"}`, background: type === t.id ? "rgba(59,130,246,0.1)" : "transparent", padding: 10, fontSize: 12 }}
                    >
                      <div style={{ fontWeight: 700, color: "#fff" }}>{t.label}</div>
                      <div style={{ marginTop: 2, color: "#888" }}>{t.desc}</div>
                    </div>
                  ))}
                </div>
                <input type="hidden" name="typeClient" value={type} />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Nom</label>
                <input name="nom" placeholder="Ex. Amadou Traoré / ONG Espoir" required style={inputStyle} />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Contact (téléphone/adresse)</label>
                <input name="contact" placeholder="Ex. +223 70 00 00 00" style={inputStyle} />
              </div>

              {type === "ONG_CONTRAT" && (
                <>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Référence contrat</label>
                    <input name="contratRef" placeholder="Ex. CT-2026-014" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Délai de paiement différé (jours)</label>
                    <input name="paiementDiffereJours" type="number" min="0" placeholder="Ex. 30" style={inputStyle} />
                  </div>
                </>
              )}

              {state.error && <p style={{ fontSize: 12.5, color: "#f87171", margin: 0 }}>{state.error}</p>}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #333", paddingTop: 14 }}>
                <button type="button" onClick={() => setDrawerOpen(false)} style={darkButton("#333", "#e0e0e0")}>
                  Annuler
                </button>
                <button type="submit" disabled={pending} style={darkButton("#3b82f6")}>
                  {pending ? "Création..." : "Créer le client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
