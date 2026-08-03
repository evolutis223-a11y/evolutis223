"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, type ShellModule } from "@/components/app-shell";
import type { affaires, articles, clients, demandesValidationStock, lignesAffaire, reglements, variantes } from "@/db/schema";
import { ajouterReglement, creerAffaire, validerAffaire, type LigneInput, type ReglementState } from "./actions";

type Client = typeof clients.$inferSelect;
type Article = typeof articles.$inferSelect;
type Variante = typeof variantes.$inferSelect;
type AffaireRow = {
  id: number;
  numero: string;
  type: string;
  statut: string;
  montantTtc: string;
  immuable: boolean;
  dateCreation: Date;
  clientNom: string;
  clientId: number;
};
type LigneRow = typeof lignesAffaire.$inferSelect;
type ReglementRow = typeof reglements.$inferSelect;
type DemandeRow = typeof demandesValidationStock.$inferSelect;

function formatFcfa(v: string | number) {
  return `${Math.round(Number(v)).toLocaleString("fr-FR")} F`;
}
function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("fr-FR");
}

const TYPE_LABEL: Record<string, string> = {
  COMMANDE_ATTENTE: "Commande en attente",
  DEVIS: "Devis",
  PROFORMA: "Proforma",
  BON_COMMANDE: "Bon de commande",
  TICKET: "Ticket",
  FACTURE: "Facture",
  AVOIR: "Avoir",
};

const initialReglementState: ReglementState = { error: null };

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

export function LigneEditorRow({
  articlesList,
  variantesList,
  ligne,
  onChange,
  onRemove,
}: {
  articlesList: Article[];
  variantesList: Variante[];
  ligne: LigneInput;
  onChange: (l: LigneInput) => void;
  onRemove: () => void;
}) {
  const article = articlesList.find((a) => a.id === ligne.articleId);
  const variantesArticle = variantesList.filter((v) => v.articleId === ligne.articleId);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, border: "1px solid #333", borderRadius: 8, padding: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <select
          style={inputStyle}
          value={ligne.articleId || ""}
          onChange={(e) => {
            const id = Number(e.target.value);
            const a = articlesList.find((x) => x.id === id);
            const varianteParDefaut = a?.famille !== "A" ? variantesList.find((v) => v.articleId === id) : null;
            onChange({ ...ligne, articleId: id, varianteId: varianteParDefaut?.id ?? null, prixUnitaire: a ? Number(a.prixVente) : 0 });
          }}
        >
          <option value="">Choisir un article...</option>
          {articlesList.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nom} ({a.code})
            </option>
          ))}
        </select>

        {article?.famille === "A" && (
          <select style={inputStyle} value={ligne.varianteId ?? ""} onChange={(e) => onChange({ ...ligne, varianteId: Number(e.target.value) })}>
            <option value="">Choisir une variante (taille/couleur)...</option>
            {variantesArticle.map((v) => (
              <option key={v.id} value={v.id}>
                {v.taille} {v.couleur}
              </option>
            ))}
          </select>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" min="1" value={ligne.quantite} onChange={(e) => onChange({ ...ligne, quantite: Number(e.target.value) })} placeholder="Qté" style={inputStyle} />
          <input type="number" min="0" value={ligne.prixUnitaire} onChange={(e) => onChange({ ...ligne, prixUnitaire: Number(e.target.value) })} placeholder="Prix unitaire" style={inputStyle} />
        </div>

        {article?.famille === "D" && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#888" }}>
            <input type="checkbox" checked={ligne.personnalise ?? true} onChange={(e) => onChange({ ...ligne, personnalise: e.target.checked })} />
            Nouveau visuel/design à concevoir (décocher si modèle déjà validé — l&apos;OF ira directement en Production)
          </label>
        )}
      </div>
      <button onClick={onRemove} aria-label="Retirer" style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 18 }}>
        &times;
      </button>
    </div>
  );
}

function NouvelleAffaireDrawer({
  clients,
  articlesList,
  variantesList,
  onClose,
}: {
  clients: Client[];
  articlesList: Article[];
  variantesList: Variante[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState<number | "">("");
  const [lignes, setLignes] = useState<LigneInput[]>([{ articleId: 0, varianteId: null, quantite: 1, prixUnitaire: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [modeFinalisation, setModeFinalisation] = useState<"" | "RETRAIT" | "LIVRAISON">("");
  const [adresse, setAdresse] = useState("");

  const total = lignes.reduce((acc, l) => acc + l.quantite * l.prixUnitaire, 0);

  async function submit() {
    setError(null);
    if (!clientId) return setError("Client requis.");
    const valid = lignes.filter((l) => l.articleId);
    if (valid.length === 0) return setError("Au moins une ligne requise.");
    if (modeFinalisation === "LIVRAISON" && !adresse.trim()) return setError("Adresse de livraison requise.");
    setPending(true);
    const res = await creerAffaire(Number(clientId), valid, modeFinalisation || null, modeFinalisation === "LIVRAISON" ? adresse.trim() : null);
    setPending(false);
    if (res.error) return setError(res.error);
    router.refresh();
    onClose();
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 10, padding: 24, width: 560, maxWidth: "92vw", maxHeight: "86vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>Nouvelle affaire</h2>
          <button onClick={onClose} aria-label="Fermer" style={{ background: "none", border: "none", color: "#888", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>
            &times;
          </button>
        </div>
        <p style={{ marginTop: 4, fontSize: 12, color: "#888" }}>
          Entre d&apos;abord comme Commande en attente (§8.1) — la validation contrôle le stock et décrémente en FIFO.
        </p>

        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Client</label>
            <select style={inputStyle} value={clientId} onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Choisir un client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888" }}>
              Finalisation (optionnel — vide = vente comptoir directe)
            </label>
            <select style={inputStyle} value={modeFinalisation} onChange={(e) => setModeFinalisation(e.target.value as "" | "RETRAIT" | "LIVRAISON")}>
              <option value="">Vente comptoir directe</option>
              <option value="RETRAIT">Retrait en boutique (préparation avant remise)</option>
              <option value="LIVRAISON">Livraison</option>
            </select>
            {modeFinalisation === "LIVRAISON" && (
              <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Adresse de livraison" style={{ ...inputStyle, marginTop: 8 }} />
            )}
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Lignes</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lignes.map((l, i) => (
                <LigneEditorRow
                  key={i}
                  articlesList={articlesList}
                  variantesList={variantesList}
                  ligne={l}
                  onChange={(nl) => setLignes((arr) => arr.map((x, j) => (j === i ? nl : x)))}
                  onRemove={() => setLignes((arr) => arr.filter((_, j) => j !== i))}
                />
              ))}
            </div>
            <button
              onClick={() => setLignes((arr) => [...arr, { articleId: 0, varianteId: null, quantite: 1, prixUnitaire: 0 }])}
              style={{ marginTop: 8, background: "none", border: "1px solid #333", color: "#3b82f6", padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
            >
              + Ajouter une ligne
            </button>
          </div>

          <div style={{ borderTop: "1px solid #333", paddingTop: 12, textAlign: "right", fontSize: 17, fontWeight: 700, color: "#fff" }}>
            Total : {formatFcfa(total)}
          </div>

          {error && (
            <p style={{ fontSize: 13, color: "#f87171", margin: 0 }} role="alert">
              {error}
            </p>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #333", paddingTop: 14 }}>
            <button type="button" onClick={onClose} style={darkButton("#333", "#e0e0e0")}>
              Annuler
            </button>
            <button type="button" disabled={pending} onClick={submit} style={darkButton("#3b82f6")}>
              {pending ? "Création..." : "Créer l'affaire"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReglementForm({ affaireId, onDone }: { affaireId: number; onDone: () => void }) {
  const [state, action, pending] = useActionState(ajouterReglement, initialReglementState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) onDone();
    wasPending.current = pending;
  }, [pending, state.error, onDone]);

  return (
    <form
      action={(fd) => {
        fd.set("affaireId", String(affaireId));
        action(fd);
      }}
      style={{ marginTop: 10, display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}
    >
      <input name="montant" type="number" min="1" placeholder="Montant" required style={{ ...inputStyle, width: 130 }} />
      <select name="mode" required style={{ ...inputStyle, width: "auto" }}>
        <option value="ESPECES">Espèces</option>
        <option value="MOBILE_MONEY">Mobile Money</option>
        <option value="VIREMENT">Virement</option>
        <option value="CARTE">Carte</option>
      </select>
      <button type="submit" disabled={pending} style={darkButton("#10b981")}>
        {pending ? "..." : "Encaisser"}
      </button>
      {state.error && <span style={{ fontSize: 11.5, color: "#f87171" }}>{state.error}</span>}
    </form>
  );
}

function statutColor(a: AffaireRow, bloquee: boolean) {
  if (bloquee) return "#f59e0b";
  if (a.statut === "CLOTUREE") return "#10b981";
  if (a.statut === "ANNULEE") return "#dc2626";
  if (!a.immuable) return "#888";
  return "#3b82f6";
}

export function AffairesClient({
  userName,
  roleLibelle,
  modules,
  clients,
  articles,
  variantes,
  affaires,
  lignes,
  reglements,
  demandesEnAttente,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  clients: Client[];
  articles: Article[];
  variantes: Variante[];
  affaires: AffaireRow[];
  lignes: LigneRow[];
  reglements: ReglementRow[];
  demandesEnAttente: DemandeRow[];
}) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(affaires[0]?.id ?? null);
  const [validating, setValidating] = useState(false);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"date" | "numero" | "solde">("date");

  const lignesByAffaire = useMemo(() => {
    const m = new Map<number, LigneRow[]>();
    for (const l of lignes) {
      if (!m.has(l.affaireId)) m.set(l.affaireId, []);
      m.get(l.affaireId)!.push(l);
    }
    return m;
  }, [lignes]);

  const reglementsByAffaire = useMemo(() => {
    const m = new Map<number, ReglementRow[]>();
    for (const r of reglements) {
      if (!m.has(r.affaireId)) m.set(r.affaireId, []);
      m.get(r.affaireId)!.push(r);
    }
    return m;
  }, [reglements]);

  const demandesByAffaire = useMemo(() => {
    const m = new Map<number, DemandeRow[]>();
    for (const d of demandesEnAttente) {
      if (!m.has(d.affaireId)) m.set(d.affaireId, []);
      m.get(d.affaireId)!.push(d);
    }
    return m;
  }, [demandesEnAttente]);

  function soldeDe(a: AffaireRow) {
    const totalRegle = (reglementsByAffaire.get(a.id) ?? []).reduce((acc, r) => acc + Number(r.montant), 0);
    return Number(a.montantTtc) - totalRegle;
  }

  const affairesFiltrees = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = affaires.filter((a) => !q || a.numero.toLowerCase().includes(q) || a.clientNom.toLowerCase().includes(q));
    list = [...list];
    if (sort === "numero") list.sort((a, b) => a.numero.localeCompare(b.numero));
    else if (sort === "solde") list.sort((a, b) => soldeDe(b) - soldeDe(a));
    else list.sort((a, b) => new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime());
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affaires, search, sort]);

  const selected = affaires.find((a) => a.id === selectedId) ?? null;

  async function handleValider(affaireId: number) {
    setValidating(true);
    setValidationMsg(null);
    const res = await validerAffaire(affaireId);
    setValidating(false);
    if (res.error) setValidationMsg(res.error);
    else if (res.blocked) setValidationMsg("Stock insuffisant — demande de validation envoyée (Admin/Super Admin, Phase 2).");
    router.refresh();
  }

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Affaires" modules={modules}>
      <div style={{ display: "flex", gap: 20, padding: 20, height: "calc(100vh - 118px)", boxSizing: "border-box" }}>
        {/* Liste */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Affaires</div>
            <button onClick={() => setDrawerOpen(true)} style={darkButton("#3b82f6")}>
              + Nouvelle
            </button>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexShrink: 0 }}>
            <input placeholder="Rechercher (n°, client)..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={{ ...inputStyle, width: 200, flexShrink: 0 }}>
              <option value="date">Trier : Date</option>
              <option value="numero">Trier : Numéro</option>
              <option value="solde">Trier : Solde décroissant</option>
            </select>
          </div>

          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, border: "1px solid #262626", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th style={{ width: "20%", padding: 10, borderBottom: "1px solid #333", textAlign: "left", color: "#888", fontSize: 11.5, position: "sticky", top: 0, background: "#151515" }}>N°</th>
                  <th style={{ width: "30%", padding: 10, borderBottom: "1px solid #333", textAlign: "left", color: "#888", fontSize: 11.5, position: "sticky", top: 0, background: "#151515" }}>Client</th>
                  <th style={{ width: "22%", padding: 10, borderBottom: "1px solid #333", textAlign: "right", color: "#888", fontSize: 11.5, position: "sticky", top: 0, background: "#151515" }}>TTC</th>
                  <th style={{ width: "28%", padding: 10, borderBottom: "1px solid #333", textAlign: "right", color: "#888", fontSize: 11.5, position: "sticky", top: 0, background: "#151515" }}>Solde</th>
                </tr>
              </thead>
              <tbody>
                {affairesFiltrees.map((a) => {
                  const bloquee = (demandesByAffaire.get(a.id) ?? []).length > 0;
                  const solde = soldeDe(a);
                  const couleur = statutColor(a, bloquee);
                  return (
                    <tr
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      style={{ cursor: "pointer", background: selectedId === a.id ? "#263041" : "transparent", borderLeft: `3px solid ${couleur}` }}
                    >
                      <td style={{ padding: 10, borderBottom: "1px solid #262626", fontSize: 12.5, color: "#e0e0e0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.numero}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #262626", fontSize: 12.5, color: "#e0e0e0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.clientNom}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #262626", fontSize: 12.5, color: "#e0e0e0", textAlign: "right" }}>{formatFcfa(a.montantTtc)}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #262626", fontSize: 12.5, color: couleur, textAlign: "right", fontWeight: 700 }}>
                        {a.immuable && solde > 0 ? formatFcfa(solde) : a.immuable ? "Soldée" : bloquee ? "Bloquée" : "—"}
                      </td>
                    </tr>
                  );
                })}
                {affairesFiltrees.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#666", fontSize: 13 }}>
                      Aucune affaire.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Détail */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {!selected ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#666", fontSize: 13, border: "1px solid #262626", borderRadius: 8 }}>
              Sélectionne une affaire à gauche.
            </div>
          ) : (
            (() => {
              const bloquee = (demandesByAffaire.get(selected.id) ?? []).length > 0;
              const totalRegle = (reglementsByAffaire.get(selected.id) ?? []).reduce((acc, r) => acc + Number(r.montant), 0);
              const solde = Number(selected.montantTtc) - totalRegle;
              return (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexShrink: 0 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
                        {selected.numero} <span style={{ fontSize: 12, fontWeight: 400, color: "#888" }}>({TYPE_LABEL[selected.type] ?? selected.type})</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#888" }}>
                        {selected.clientNom} · {formatDate(selected.dateCreation)}
                      </div>
                    </div>
                    {!selected.immuable && !bloquee && (
                      <button disabled={validating} onClick={() => handleValider(selected.id)} style={darkButton("#dc2626")}>
                        {validating ? "Validation..." : "✅ Valider (contrôle stock)"}
                      </button>
                    )}
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", border: "1px solid #262626", borderRadius: 8, padding: 16 }}>
                    <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ textAlign: "left", color: "#888", fontSize: 11 }}>
                          <th style={{ paddingBottom: 6, textTransform: "uppercase" }}>Article</th>
                          <th style={{ paddingBottom: 6, textTransform: "uppercase" }}>Qté</th>
                          <th style={{ paddingBottom: 6, textTransform: "uppercase" }}>PU</th>
                          <th style={{ paddingBottom: 6, textTransform: "uppercase", textAlign: "right" }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(lignesByAffaire.get(selected.id) ?? []).map((l) => {
                          const art = articles.find((x) => x.id === l.articleId);
                          const vnt = variantes.find((v) => v.id === l.varianteId);
                          return (
                            <tr key={l.id} style={{ borderTop: "1px solid #262626" }}>
                              <td style={{ padding: "7px 0", color: "#e0e0e0" }}>
                                {art?.nom} {vnt ? `— ${vnt.taille ?? ""} ${vnt.couleur ?? ""}` : ""}
                              </td>
                              <td style={{ padding: "7px 0", color: "#ccc" }}>{l.quantite}</td>
                              <td style={{ padding: "7px 0", color: "#ccc" }}>{formatFcfa(l.prixUnitaire)}</td>
                              <td style={{ padding: "7px 0", color: "#fff", textAlign: "right", fontWeight: 700 }}>{formatFcfa(Number(l.prixUnitaire) * l.quantite)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {bloquee && (
                      <p style={{ marginTop: 14, borderLeft: "2px solid #f59e0b", background: "rgba(245,158,11,0.1)", padding: 12, borderRadius: 6, fontSize: 12.5, color: "#fcd34d" }}>
                        Réserve détail insuffisante pour au moins une ligne. Demande envoyée pour validation Admin/Super Admin — décision sur{" "}
                        <a href="/validations" style={{ color: "#fcd34d", textDecoration: "underline" }}>
                          /validations
                        </a>{" "}
                        (§9). Pas de décrément tant que non résolu.
                      </p>
                    )}

                    {selected.immuable && (
                      <div style={{ marginTop: 16, borderTop: "1px solid #262626", paddingTop: 14 }}>
                        <div style={{ fontSize: 13, color: "#ccc" }}>
                          Réglé : <span style={{ color: "#fff", fontWeight: 700 }}>{formatFcfa(totalRegle)}</span> — Solde :{" "}
                          <span style={{ color: solde > 0 ? "#f59e0b" : "#10b981", fontWeight: 700 }}>{formatFcfa(solde)}</span>
                        </div>
                        {solde > 0 && <ReglementForm affaireId={selected.id} onDone={() => router.refresh()} />}
                      </div>
                    )}

                    {validationMsg && (
                      <p style={{ marginTop: 12, fontSize: 12.5, color: "#f87171" }}>{validationMsg}</p>
                    )}
                  </div>
                </>
              );
            })()
          )}
        </div>
      </div>

      {drawerOpen && (
        <NouvelleAffaireDrawer
          clients={clients}
          articlesList={articles}
          variantesList={variantes}
          onClose={() => {
            setDrawerOpen(false);
            router.refresh();
          }}
        />
      )}
    </AppShell>
  );
}
