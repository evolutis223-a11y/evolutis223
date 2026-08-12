"use client";

import { useEffect, useMemo, useRef, useState, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell, type ShellModule } from "@/components/app-shell";
import { AideBulle } from "@/components/ui/aide-bulle";
import { DocumentPreview, type DocumentPreviewData } from "@/components/documents/document-preview";
import { formatFcfa } from "@/lib/format";
import { enregistrerReglement, type ReglementLibreState } from "./actions";

const initialReglementLibreState: ReglementLibreState = { error: null };

type AffaireRow = {
  id: number;
  numero: string;
  type: string;
  immuable: boolean;
  dateCreation: Date;
  objet: string | null;
  clientNom: string;
  clientAdresse: string | null;
  clientTelephone: string | null;
  commercialNom: string;
  provenance: string | null;
  modeFinalisation: string | null;
  tvaPct: string | null;
  remiseMontant: string | null;
  remiseUnite: string | null;
  montantTtc: string;
  infosComplementaires: string | null;
  mentionValidite: string | null;
  acomptePct: string | null;
  adresseLivraison: string | null;
  lignes: { nom: string; qte: number; pu: number }[];
};

type ReglementRow = {
  id: number;
  affaireId: number | null;
  payeurNom: string | null;
  payeurPrenom: string | null;
  payeurTelephone: string | null;
  reference: string | null;
  commentaire: string | null;
  montant: string;
  mode: string;
  dateReglement: Date;
};

const MODE_LABEL: Record<string, string> = { ESPECES: "Espèces", MOBILE_MONEY: "Mobile Money", CHEQUE: "Chèque", VIREMENT: "Virement" };

const inputStyle: React.CSSProperties = {
  minWidth: 0,
  width: "100%",
  background: "#121212",
  border: "1px solid #333",
  color: "#e0e0e0",
  padding: "12px 14px",
  borderRadius: 8,
  fontSize: 15,
  boxSizing: "border-box",
};
function darkButton(bg: string, color = "#fff"): React.CSSProperties {
  return { background: bg, color, border: "none", padding: "11px 20px", borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: "pointer" };
}
function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("fr-FR");
}

export function ReglementsClient({
  userName,
  roleLibelle,
  modules,
  affaires,
  reglements,
  masthead,
  mentionsValidite,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  affaires: AffaireRow[];
  reglements: ReglementRow[];
  masthead: string;
  mentionsValidite: Record<string, string>;
}) {
  const searchParams = useSearchParams();
  const [localReglements, setLocalReglements] = useState(reglements);
  const [regNewSearch, setRegNewSearch] = useState("");
  const [regFoundId, setRegFoundId] = useState<number | null>(null);
  const [regNom, setRegNom] = useState("");
  const [regPrenom, setRegPrenom] = useState("");
  const [regTelephone, setRegTelephone] = useState("");
  const [regMontant, setRegMontant] = useState("");
  const [regMode, setRegMode] = useState("ESPECES");
  const [regReference, setRegReference] = useState("");
  const [regComment, setRegComment] = useState("");
  const [regJustSaved, setRegJustSaved] = useState(false);
  const [regSavedToAttente, setRegSavedToAttente] = useState(false);

  const [state, action, pending] = useActionState(enregistrerReglement, initialReglementLibreState);
  const wasPending = useRef(false);

  const reglementsByAffaire = useMemo(() => {
    const m = new Map<number, ReglementRow[]>();
    for (const r of localReglements) {
      if (r.affaireId == null) continue;
      if (!m.has(r.affaireId)) m.set(r.affaireId, []);
      m.get(r.affaireId)!.push(r);
    }
    return m;
  }, [localReglements]);

  function totalRegleDe(a: AffaireRow) {
    return (reglementsByAffaire.get(a.id) ?? []).reduce((s, r) => s + Number(r.montant), 0);
  }
  function soldeDe(a: AffaireRow) {
    return Number(a.montantTtc) - totalRegleDe(a);
  }

  const regSearchResults = useMemo(() => {
    const q = regNewSearch.trim().toLowerCase();
    if (!q) return [];
    return affaires
      .filter((a) => (a.numero + a.clientNom + (a.objet ?? "")).toLowerCase().includes(q))
      .slice(0, 8)
      .map((a) => ({ id: a.id, numero: a.numero, client: a.clientNom, solde: soldeDe(a) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affaires, regNewSearch, reglementsByAffaire]);

  const regFoundDoc = regFoundId != null ? affaires.find((a) => a.id === regFoundId) ?? null : null;

  useEffect(() => {
    const pre = searchParams.get("affaire");
    if (!pre) return;
    const a = affaires.find((x) => x.id === Number(pre));
    if (a) {
      setRegFoundId(a.id);
      setRegNewSearch(a.numero);
      setRegMontant(String(soldeDe(a)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (wasPending.current && !pending) {
      if (!state.error) {
        setRegJustSaved(!state.savedToAttente);
        setRegSavedToAttente(!!state.savedToAttente);
        setLocalReglements((prev) => [
          {
            id: -Date.now(),
            affaireId: regFoundId,
            payeurNom: regNom || null,
            payeurPrenom: regPrenom || null,
            payeurTelephone: regTelephone || null,
            reference: regReference || null,
            commentaire: regComment || null,
            montant: regMontant,
            mode: regMode,
            dateReglement: new Date(),
          },
          ...prev,
        ]);
      }
    }
    wasPending.current = pending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, state]);

  function closeRegFound() {
    setRegFoundId(null);
    setRegNewSearch("");
    setRegNom("");
    setRegPrenom("");
    setRegTelephone("");
    setRegReference("");
    setRegMontant("");
    setRegComment("");
    setRegJustSaved(false);
    setRegSavedToAttente(false);
  }

  const isModeWithRef = regMode === "VIREMENT" || regMode === "MOBILE_MONEY";

  const totalReglements = localReglements.reduce((s, r) => s + Number(r.montant), 0);
  const nbReglements = localReglements.length;
  const modeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    localReglements.forEach((r) => {
      counts[r.mode] = (counts[r.mode] ?? 0) + 1;
    });
    return Object.entries(counts).map(([mode, count]) => ({ mode: MODE_LABEL[mode] ?? mode, count }));
  }, [localReglements]);

  const affaireById = useMemo(() => new Map(affaires.map((a) => [a.id, a])), [affaires]);

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Règlements" modules={modules}>
      <div style={{ flex: 1, padding: 20, display: "flex", gap: 20, overflow: "hidden" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexShrink: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Fiche de règlement</div>
            <AideBulle titre="Comment utiliser Règlements">
              <p>
                <b>Lié à une affaire</b> — recherche par nom/n° de facture, l&apos;encaissement vient réduire ce qu&apos;il reste à payer sur cette affaire précise.
              </p>
              <p>
                <b>Sans affaire</b> — encaissement libre (ex. un acompte informel) : renseigne le payeur, le mode (espèces, Mobile Money, chèque, virement) et le montant, un reçu se génère.
              </p>
            </AideBulle>
          </div>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 8, flexShrink: 0 }}>Lier à une affaire (facultatif — nom, n° de facture, objet...)</div>
          <input
            placeholder="Rechercher une affaire..."
            value={regNewSearch}
            onChange={(e) => {
              setRegNewSearch(e.target.value);
              setRegFoundId(null);
              setRegJustSaved(false);
            }}
            style={{ ...inputStyle, padding: "10px 14px", fontSize: 14, marginBottom: 8, flexShrink: 0 }}
          />
          <div style={{ flexShrink: 0 }}>
            {regSearchResults.map((res) => (
              <div
                key={res.id}
                onClick={() => {
                  setRegFoundId(res.id);
                  setRegMontant(String(res.solde));
                  setRegMode("ESPECES");
                  setRegJustSaved(false);
                }}
                style={{ cursor: "pointer", padding: "9px 12px", background: "#1e1e1e", border: "1px solid #333", borderRadius: 6, marginBottom: 6, display: "flex", justifyContent: "space-between", fontSize: 13 }}
              >
                <span>
                  <b>{res.numero}</b> — {res.client}
                </span>
                <span style={{ color: "#f59e0b" }}>{formatFcfa(res.solde)} dû</span>
              </div>
            ))}
          </div>
          {regFoundDoc && (
            <div style={{ fontSize: 13, color: "#10b981", marginBottom: 10, flexShrink: 0 }}>
              ✔ Lié à {regFoundDoc.numero} — {regFoundDoc.clientNom}{" "}
              <button onClick={closeRegFound} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 12 }}>
                ✕ délier
              </button>
            </div>
          )}

          <div style={{ height: 1, background: "#333", margin: "6px 0 14px" }} />

          <form
            action={(fd) => {
              fd.set("affaireId", regFoundId != null ? String(regFoundId) : "");
              action(fd);
            }}
            style={{ display: "flex", flexDirection: "column", minHeight: 0, overflowY: "auto" }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12, flexShrink: 0 }}>
              <input name="nom" placeholder="Nom" value={regNom} onChange={(e) => setRegNom(e.target.value)} style={inputStyle} />
              <input name="prenom" placeholder="Prénom" value={regPrenom} onChange={(e) => setRegPrenom(e.target.value)} style={inputStyle} />
            </div>
            <input
              name="telephone"
              placeholder="Téléphone"
              value={regTelephone}
              onChange={(e) => setRegTelephone(e.target.value)}
              style={{ ...inputStyle, marginBottom: 12, flexShrink: 0 }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12, flexShrink: 0 }}>
              <input
                name="montant"
                type="number"
                min="1"
                placeholder="Montant versé"
                required
                value={regMontant}
                onChange={(e) => setRegMontant(e.target.value)}
                style={inputStyle}
              />
              <select name="mode" value={regMode} onChange={(e) => setRegMode(e.target.value)} style={inputStyle}>
                <option value="ESPECES">Espèces</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="CHEQUE">Chèque</option>
                <option value="VIREMENT">Virement</option>
              </select>
            </div>
            {isModeWithRef && (
              <input
                name="reference"
                placeholder="Référence / N° opération"
                value={regReference}
                onChange={(e) => setRegReference(e.target.value)}
                style={{ ...inputStyle, marginBottom: 12, flexShrink: 0 }}
              />
            )}
            <input
              name="commentaire"
              placeholder="Commentaire (facultatif)"
              value={regComment}
              onChange={(e) => setRegComment(e.target.value)}
              style={{ ...inputStyle, marginBottom: 12, flexShrink: 0 }}
            />
            <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
              <button type="submit" disabled={pending} style={darkButton("#10b981")}>
                {pending ? "..." : "💾 Enregistrer"}
              </button>
              <button type="button" onClick={closeRegFound} style={darkButton("#333", "#e0e0e0")}>
                Annuler
              </button>
            </div>
            {state.error && <div style={{ marginTop: 10, fontSize: 13, color: "#f87171" }}>{state.error}</div>}
            {regJustSaved && (
              <div style={{ marginTop: 12, padding: 10, background: "rgba(16,185,129,0.12)", border: "1px solid #10b981", color: "#10b981", borderRadius: 6, fontSize: 14, flexShrink: 0 }}>
                ✅ Paiement enregistré et déduit de l&apos;affaire. Voulez-vous imprimer le reçu ?{" "}
                <button type="button" onClick={() => window.print()} style={{ background: "#10b981", color: "#fff", border: "none", padding: "5px 10px", borderRadius: 4, marginLeft: 8, cursor: "pointer" }}>
                  🖨️ Imprimer
                </button>
              </div>
            )}
            {regSavedToAttente && (
              <div style={{ marginTop: 12, padding: 10, background: "rgba(245,158,11,0.12)", border: "1px solid #f59e0b", color: "#f59e0b", borderRadius: 6, fontSize: 14, flexShrink: 0 }}>
                ⚠ Aucune affaire liée — l&apos;argent est encaissé et placé sur le Compte d&apos;attente en attendant validation. Voulez-vous imprimer le reçu provisoire ?{" "}
                <button type="button" onClick={() => window.print()} style={{ background: "#f59e0b", color: "#fff", border: "none", padding: "5px 10px", borderRadius: 4, marginLeft: 8, cursor: "pointer" }}>
                  🖨️ Imprimer
                </button>
                <div style={{ marginTop: 6, fontSize: 13, color: "#f59e0b", opacity: 0.85 }}>
                  Compte d&apos;attente : {formatFcfa(Number(regMontant) || 0)} — {[regNom, regPrenom].filter(Boolean).join(" ") || "Identité non précisée"} — {MODE_LABEL[regMode]}
                </div>
              </div>
            )}
          </form>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {regFoundDoc ? (
            <PanneauDocumentLie
              affaire={regFoundDoc}
              historique={reglementsByAffaire.get(regFoundDoc.id) ?? []}
              masthead={masthead}
              mentionsValidite={mentionsValidite}
            />
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Résumé — Règlements</div>
                <button onClick={() => window.print()} style={{ background: "#3b82f6", color: "#fff", border: "none", padding: "7px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                  🖨️ Imprimer
                </button>
              </div>
              <div style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: 24, flex: 1, overflowY: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                  <div style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
                    <span style={{ color: "#888", fontSize: 13, whiteSpace: "nowrap" }}>Total encaissé</span>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#10b981", whiteSpace: "nowrap", marginTop: 4 }}>{formatFcfa(totalReglements)}</div>
                  </div>
                  <div style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
                    <span style={{ color: "#888", fontSize: 13, whiteSpace: "nowrap" }}>Règlements</span>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#3b82f6", whiteSpace: "nowrap", marginTop: 4 }}>{nbReglements}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Répartition par mode de paiement</div>
                {modeBreakdown.map((m) => (
                  <div key={m.mode} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "5px 0", borderBottom: "1px solid #262626" }}>
                    <span>{m.mode}</span>
                    <span>{m.count}</span>
                  </div>
                ))}
                {modeBreakdown.length === 0 && <p style={{ fontSize: 13, color: "#666" }}>Aucun règlement encore enregistré.</p>}

                <div style={{ fontSize: 13, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", margin: "20px 0 10px" }}>Règlements récents</div>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "22%", padding: 8, borderBottom: "1px solid #333", textAlign: "left", color: "#888", fontSize: 12 }}>Affaire</th>
                      <th style={{ width: "28%", padding: 8, borderBottom: "1px solid #333", textAlign: "left", color: "#888", fontSize: 12 }}>Client</th>
                      <th style={{ width: "18%", padding: 8, borderBottom: "1px solid #333", textAlign: "left", color: "#888", fontSize: 12 }}>Date</th>
                      <th style={{ width: "32%", padding: 8, borderBottom: "1px solid #333", textAlign: "right", color: "#888", fontSize: 12 }}>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localReglements.map((r) => {
                      const aff = r.affaireId != null ? affaireById.get(r.affaireId) : null;
                      const client = aff ? aff.clientNom : [r.payeurNom, r.payeurPrenom].filter(Boolean).join(" ") || "Compte d'attente";
                      return (
                        <tr key={r.id}>
                          <td style={{ width: "22%", padding: 8, borderBottom: "1px solid #262626", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{aff?.numero ?? "—"}</td>
                          <td style={{ width: "28%", padding: 8, borderBottom: "1px solid #262626", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client}</td>
                          <td style={{ width: "18%", padding: 8, borderBottom: "1px solid #262626", color: "#888", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatDate(r.dateReglement)}</td>
                          <td style={{ width: "32%", padding: 8, borderBottom: "1px solid #262626", textAlign: "right", color: "#10b981", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{formatFcfa(r.montant)}</td>
                        </tr>
                      );
                    })}
                    {localReglements.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#666", fontSize: 13 }}>
                          Rien à afficher.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function PanneauDocumentLie({
  affaire,
  historique,
  masthead,
  mentionsValidite,
}: {
  affaire: AffaireRow;
  historique: ReglementRow[];
  masthead: string;
  mentionsValidite: Record<string, string>;
}) {
  const totalRegle = historique.reduce((s, r) => s + Number(r.montant), 0);

  const historiqueTri = [...historique].sort((a, b) => new Date(a.dateReglement).getTime() - new Date(b.dateReglement).getTime());
  let cumul = 0;
  const historiquePaiements = historiqueTri.map((r) => {
    cumul += Number(r.montant);
    const type = cumul >= Number(affaire.montantTtc) ? "Solde final" : cumul === Number(r.montant) ? "Acompte" : "Règlement partiel";
    return { date: r.dateReglement, type, mode: MODE_LABEL[r.mode] ?? r.mode, montant: Number(r.montant) };
  });

  const previewData: DocumentPreviewData = {
    type: affaire.type,
    numero: affaire.numero,
    dateCreation: affaire.dateCreation,
    immuable: affaire.immuable,
    objet: affaire.objet,
    clientNom: affaire.clientNom,
    clientAdresse: affaire.clientAdresse,
    clientTelephone: affaire.clientTelephone,
    commercialNom: affaire.commercialNom,
    provenance: affaire.provenance,
    modeFinalisation: affaire.modeFinalisation,
    adresseLivraison: affaire.adresseLivraison,
    tvaPct: affaire.tvaPct ? Number(affaire.tvaPct) : null,
    remiseMontant: affaire.remiseMontant ? Number(affaire.remiseMontant) : null,
    remiseUnite: affaire.remiseUnite,
    montantTtc: Number(affaire.montantTtc),
    montantRegle: totalRegle,
    infosComplementaires: affaire.infosComplementaires,
    mentionValidite: affaire.mentionValidite || mentionsValidite[affaire.type] || null,
    acomptePct: affaire.acomptePct != null ? Number(affaire.acomptePct) : null,
    lignes: affaire.lignes,
    historiquePaiements,
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
          Aperçu {affaire.numero}
        </div>
        <a
          href={`/api/documents/affaire/${affaire.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ background: "#3b82f6", color: "#fff", border: "none", padding: "7px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer", textDecoration: "none" }}
        >
          🖨️ Imprimer
        </a>
      </div>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <DocumentPreview data={previewData} masthead={masthead} />
      </div>
    </>
  );
}
