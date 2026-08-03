"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { AppShell, type ShellModule } from "@/components/app-shell";
import type { articles, branches } from "@/db/schema";
import {
  createArticle,
  definirCategorieMarquage,
  definirPrixRevient,
  definirPrixRevientCalcule,
  toggleNecessiteAssemblage,
  togglePublieBoutique,
  type CreateArticleState,
} from "./actions";
import { calculerPrixRevient, type CompositionCout } from "@/lib/calculateurs/coutRevient";
import { FAMILLES, FamilleIcon, familleMeta, type FamilleId } from "./familles";

type Article = typeof articles.$inferSelect;
type Branche = typeof branches.$inferSelect;

function formatFcfa(value: string | number): string {
  return `${Math.round(Number(value)).toLocaleString("fr-FR")} F`;
}

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

function Thumb({ article, size }: { article: Article; size: number }) {
  const meta = familleMeta(article.famille);
  if (article.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={article.photoUrl} alt={article.nom} style={{ width: size, height: size, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />;
  }
  return (
    <div className={meta.tileClass} style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, flexShrink: 0, filter: "saturate(0.7) brightness(0.85)" }}>
      <FamilleIcon id={article.famille as FamilleId} className="h-1/2 w-1/2" />
    </div>
  );
}

const initialCreateState: CreateArticleState = { error: null };

const emptyComposition: CompositionCout = { matieres: [], mo: [], frais: [], margePct: 0 };

function CoutCalculatorModal({
  initial,
  onSync,
  onClose,
}: {
  initial: CompositionCout | null;
  onSync: (composition: CompositionCout, prixRevient: number) => void;
  onClose: () => void;
}) {
  const [matieres, setMatieres] = useState(initial?.matieres.length ? initial.matieres : [{ nom: "", qte: 0, cout: 0 }]);
  const [mo, setMo] = useState(initial?.mo.length ? initial.mo : [{ nom: "", heures: 0, taux: 0, forfait: 0 }]);
  const [frais, setFrais] = useState(initial?.frais.length ? initial.frais : [{ nom: "", montant: 0 }]);
  const [margePct, setMargePct] = useState(initial?.margePct ?? 0);

  const composition: CompositionCout = { matieres, mo, frais, margePct };
  const prixRevient = calculerPrixRevient(composition);

  const rowStyle: React.CSSProperties = { display: "flex", gap: 8, marginBottom: 8 };
  const smallInput = (w: number): React.CSSProperties => ({ ...inputStyle, width: w, padding: "9px 10px", fontSize: 13 });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#151515", border: "1px solid #333", borderRadius: 10, width: "min(560px,94vw)", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #333", flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>Calculateur de coût de revient</div>
          <button onClick={onClose} style={darkButton("#333")}>✕ Fermer</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>Matières premières</div>
          {matieres.map((m, i) => (
            <div key={i} style={rowStyle}>
              <input placeholder="Libellé matière" value={m.nom} onChange={(e) => setMatieres((r) => r.map((x, j) => (j === i ? { ...x, nom: e.target.value } : x)))} style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
              <input placeholder="Qté" type="number" value={m.qte || ""} onChange={(e) => setMatieres((r) => r.map((x, j) => (j === i ? { ...x, qte: Number(e.target.value) } : x)))} style={smallInput(70)} />
              <input placeholder="Coût unit." type="number" value={m.cout || ""} onChange={(e) => setMatieres((r) => r.map((x, j) => (j === i ? { ...x, cout: Number(e.target.value) } : x)))} style={smallInput(100)} />
              <button onClick={() => setMatieres((r) => r.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 15 }}>🗑️</button>
            </div>
          ))}
          <button onClick={() => setMatieres((r) => [...r, { nom: "", qte: 0, cout: 0 }])} style={{ background: "none", border: "1px dashed #3b82f6", color: "#3b82f6", padding: 8, width: "100%", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 16 }}>+ Ajouter une matière</button>

          <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 8px" }}>Main-d&apos;œuvre (MO)</div>
          {mo.map((m, i) => (
            <div key={i} style={rowStyle}>
              <input placeholder="Opération / Poste" value={m.nom} onChange={(e) => setMo((r) => r.map((x, j) => (j === i ? { ...x, nom: e.target.value } : x)))} style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
              <input placeholder="Heures" type="number" value={m.heures || ""} onChange={(e) => setMo((r) => r.map((x, j) => (j === i ? { ...x, heures: Number(e.target.value) } : x)))} style={smallInput(70)} />
              <input placeholder="Taux/h" type="number" value={m.taux || ""} onChange={(e) => setMo((r) => r.map((x, j) => (j === i ? { ...x, taux: Number(e.target.value) } : x)))} style={smallInput(80)} />
              <input placeholder="Forfait" type="number" value={m.forfait || ""} onChange={(e) => setMo((r) => r.map((x, j) => (j === i ? { ...x, forfait: Number(e.target.value) } : x)))} style={smallInput(80)} />
              <button onClick={() => setMo((r) => r.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 15 }}>🗑️</button>
            </div>
          ))}
          <button onClick={() => setMo((r) => [...r, { nom: "", heures: 0, taux: 0, forfait: 0 }])} style={{ background: "none", border: "1px dashed #3b82f6", color: "#3b82f6", padding: 8, width: "100%", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 16 }}>+ Ajouter de la main-d&apos;œuvre</button>

          <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 8px" }}>Autres frais</div>
          {frais.map((f, i) => (
            <div key={i} style={rowStyle}>
              <input placeholder="Libellé du frais" value={f.nom} onChange={(e) => setFrais((r) => r.map((x, j) => (j === i ? { ...x, nom: e.target.value } : x)))} style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
              <input placeholder="Montant" type="number" value={f.montant || ""} onChange={(e) => setFrais((r) => r.map((x, j) => (j === i ? { ...x, montant: Number(e.target.value) } : x)))} style={smallInput(120)} />
              <button onClick={() => setFrais((r) => r.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 15 }}>🗑️</button>
            </div>
          ))}
          <button onClick={() => setFrais((r) => [...r, { nom: "", montant: 0 }])} style={{ background: "none", border: "1px dashed #3b82f6", color: "#3b82f6", padding: 8, width: "100%", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 16 }}>+ Ajouter des frais</button>

          <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 8px" }}>Configuration de marge</div>
          <label style={{ display: "block", fontSize: 11, color: "#888", textTransform: "uppercase", marginBottom: 4 }}>Marge souhaitée (%)</label>
          <input type="number" value={margePct || ""} onChange={(e) => setMargePct(Number(e.target.value))} style={{ ...inputStyle, marginBottom: 16 }} />

          <div style={{ padding: 12, background: "#121212", borderRadius: 6, borderLeft: "4px solid #f59e0b", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", fontWeight: 700 }}>Prix de revient calculé (marge incluse) :</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#f59e0b" }}>{formatFcfa(prixRevient)}</div>
          </div>
          <button onClick={() => onSync(composition, prixRevient)} style={{ background: "#3b82f6", color: "#fff", border: "none", padding: 14, width: "100%", borderRadius: 6, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>Synchroniser ➜</button>
        </div>
      </div>
    </div>
  );
}

export function CatalogueClient({
  userName,
  roleLibelle,
  modules,
  articles: initialArticles,
  branches,
  isSuperAdmin,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  articles: Article[];
  branches: Branche[];
  isSuperAdmin: boolean;
}) {
  const brancheNom = (id: number | null) => branches.find((b) => b.id === id)?.nom ?? null;
  const [activeFamille, setActiveFamille] = useState<FamilleId | "TOUS">("TOUS");
  const [detailArticle, setDetailArticle] = useState<Article | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFamille, setDrawerFamille] = useState<FamilleId | null>(null);
  const [codeSuffix, setCodeSuffix] = useState("");
  const [calcOpenFor, setCalcOpenFor] = useState<"detail" | "new" | null>(null);
  const [newPrixRevientDraft, setNewPrixRevientDraft] = useState("");
  const [createState, createAction, pending] = useActionState(createArticle, initialCreateState);
  const [formKey, setFormKey] = useState(0);
  const wasPending = useRef(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"" | "prixDesc" | "prixAsc">("");

  useEffect(() => {
    if (wasPending.current && !pending && !createState.error) {
      setDrawerOpen(false);
      setFormKey((k) => k + 1);
      setDrawerFamille(null);
      setCodeSuffix("");
      setNewPrixRevientDraft("");
    }
    wasPending.current = pending;
  }, [pending, createState.error]);

  const filtered = useMemo(() => {
    let list =
      activeFamille === "TOUS" ? initialArticles : initialArticles.filter((a) => a.famille === activeFamille);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((a) => a.code.toLowerCase().includes(q) || a.nom.toLowerCase().includes(q));
    list = [...list];
    if (sort === "prixDesc") list.sort((a, b) => Number(b.prixVente) - Number(a.prixVente));
    else if (sort === "prixAsc") list.sort((a, b) => Number(a.prixVente) - Number(b.prixVente));
    return list;
  }, [initialArticles, activeFamille, search, sort]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { TOUS: initialArticles.length };
    for (const f of FAMILLES) c[f.id] = initialArticles.filter((a) => a.famille === f.id).length;
    return c;
  }, [initialArticles]);

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Catalogue" modules={modules}>
      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Catalogue</div>
          {isSuperAdmin && (
            <button onClick={() => setDrawerOpen(true)} style={darkButton("#3b82f6")}>
              + Nouvel article
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input placeholder="Rechercher (code, nom...)" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={{ ...inputStyle, width: 200 }}>
            <option value="">Tri par défaut</option>
            <option value="prixDesc">Prix : le plus élevé</option>
            <option value="prixAsc">Prix : le plus bas</option>
          </select>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {[{ id: "TOUS" as const, short: "Tous" }, ...FAMILLES].map((f) => {
            const active = activeFamille === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setActiveFamille(f.id)}
                style={{
                  borderRadius: 999,
                  border: `1px solid ${active ? "#3b82f6" : "#333"}`,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  background: active ? "#3b82f6" : "transparent",
                  color: active ? "#fff" : "#888",
                  cursor: "pointer",
                }}
              >
                {counts[f.id] ?? 0} {f.short}
              </button>
            );
          })}
        </div>

        <div style={{ border: "1px solid #262626", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ width: "12%", padding: 10, textAlign: "left", color: "#888", fontSize: 11.5, borderBottom: "1px solid #333" }}>Code</th>
                <th style={{ width: "38%", padding: 10, textAlign: "left", color: "#888", fontSize: 11.5, borderBottom: "1px solid #333" }}>Article</th>
                <th style={{ width: "16%", padding: 10, textAlign: "left", color: "#888", fontSize: 11.5, borderBottom: "1px solid #333" }}>Catégorie</th>
                <th style={{ width: "16%", padding: 10, textAlign: "right", color: "#888", fontSize: 11.5, borderBottom: "1px solid #333" }}>Prix de vente</th>
                <th style={{ width: "18%", padding: 10, textAlign: "right", color: "#888", fontSize: 11.5, borderBottom: "1px solid #333" }}>Famille / Publié</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#666", fontSize: 13 }}>
                    {search.trim() ? "Aucun article ne correspond à cette recherche." : "Aucun article dans cette famille."}
                  </td>
                </tr>
              )}
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setDetailArticle(a)}
                  style={{ cursor: "pointer", borderLeft: `3px solid ${a.publieBoutique ? "#10b981" : "#333"}` }}
                >
                  <td style={{ padding: 10, borderBottom: "1px solid #262626", color: "#888", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.code}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #262626" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Thumb article={a} size={34} />
                      <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{a.nom}</span>
                    </div>
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #262626", color: "#888", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {brancheNom(a.brancheId) ?? "—"}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #262626", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>{formatFcfa(a.prixVente)}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #262626", textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#888" }}>{familleMeta(a.famille).short}</div>
                    <div style={{ fontSize: 11, color: a.publieBoutique ? "#34d399" : "#666" }}>{a.publieBoutique ? "Publié" : "Non publié"}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detailArticle && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => e.target === e.currentTarget && setDetailArticle(null)}
        >
          <div style={{ width: 620, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto", background: "#1e1e1e", border: "1px solid #333", borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", padding: 10 }}>
              <button onClick={() => setDetailArticle(null)} style={{ background: "none", border: "none", color: "#888", fontSize: 20, cursor: "pointer" }}>
                &times;
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 20, padding: "0 24px 24px" }}>
              <div style={{ height: 180, borderRadius: 8, overflow: "hidden" }}>
                <Thumb article={detailArticle} size={200} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace" }}>{detailArticle.code}</div>
                <h2 style={{ marginTop: 4, fontSize: 17, fontWeight: 700, color: "#fff" }}>{detailArticle.nom}</h2>
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ borderRadius: 999, background: "#333", color: "#ccc", padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{familleMeta(detailArticle.famille).short}</span>
                  {brancheNom(detailArticle.brancheId) && <span style={{ fontSize: 12, color: "#888" }}>{brancheNom(detailArticle.brancheId)}</span>}
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#f59e0b" }}>{formatFcfa(detailArticle.prixVente)}</span>
                </div>
                <div style={{ marginTop: 14, borderLeft: "2px solid #3b82f6", background: "#151515", padding: 12, borderRadius: 6, fontSize: 12.5, color: "#aaa" }}>
                  {detailArticle.famille === "E"
                    ? "Recette du kit à définir dans Stocks (§8.3) — le stock est calculé automatiquement depuis les composants."
                    : detailArticle.famille === "C" || detailArticle.famille === "D"
                      ? familleMeta(detailArticle.famille).guidance
                      : "Stock — variantes, approvisionnement et lots se renseignent dans Stocks."}
                </div>
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={() => {
                      const next = !detailArticle.publieBoutique;
                      togglePublieBoutique(detailArticle.id, next);
                      setDetailArticle({ ...detailArticle, publieBoutique: next });
                    }}
                    style={{
                      position: "relative",
                      width: 36,
                      height: 20,
                      borderRadius: 999,
                      border: "none",
                      cursor: "pointer",
                      background: detailArticle.publieBoutique ? "#10b981" : "#333",
                    }}
                  >
                    <span style={{ position: "absolute", top: 2, left: detailArticle.publieBoutique ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
                  </button>
                  <span style={{ fontSize: 12, color: "#888" }}>{detailArticle.publieBoutique ? "Publié sur la boutique" : "Non publié"}</span>
                </div>

                {detailArticle.famille === "E" && (
                  <label style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#e0e0e0" }}>
                    <input
                      type="checkbox"
                      checked={detailArticle.necessiteAssemblage}
                      onChange={(e) => {
                        const next = e.target.checked;
                        toggleNecessiteAssemblage(detailArticle.id, next);
                        setDetailArticle({ ...detailArticle, necessiteAssemblage: next });
                      }}
                    />
                    Nécessite assemblage — déclenche un Ordre de Fabrication à la vente
                  </label>
                )}
                {detailArticle.famille === "A" && (
                  <div style={{ marginTop: 12 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Type de marquage</label>
                    <select
                      value={detailArticle.categorieMarquage ?? ""}
                      onChange={(e) => {
                        const next = (e.target.value || null) as "ENSEMBLE" | "TISSU" | null;
                        definirCategorieMarquage(detailArticle.id, next);
                        setDetailArticle({ ...detailArticle, categorieMarquage: next });
                      }}
                      style={inputStyle}
                    >
                      <option value="">Non concerné</option>
                      <option value="ENSEMBLE">Ensemble (bascule haut + bas)</option>
                      <option value="TISSU">Tissu (zones ou toute la surface)</option>
                    </select>
                  </div>
                )}
                {(detailArticle.famille === "C" || detailArticle.famille === "D") && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Prix de revient</label>
                      <button onClick={() => setCalcOpenFor("detail")} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>🧮 Calculateur</button>
                    </div>
                    <input
                      key={detailArticle.pmp}
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={detailArticle.pmp}
                      onBlur={(e) => {
                        const next = Number(e.target.value);
                        if (!Number.isFinite(next) || next < 0) return;
                        definirPrixRevient(detailArticle.id, next);
                        setDetailArticle({ ...detailArticle, pmp: next.toFixed(2) });
                      }}
                      style={inputStyle}
                    />
                    {Boolean(detailArticle.compositionCout) && (
                      <div style={{ marginTop: 8, fontSize: 11, color: "#666" }}>📊 Détail issu du calculateur — marge {(detailArticle.compositionCout as CompositionCout).margePct}%</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {drawerOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "flex-end" }} onClick={(e) => e.target === e.currentTarget && setDrawerOpen(false)}>
          <div style={{ width: 460, maxWidth: "92vw", height: "100%", overflowY: "auto", background: "#1e1e1e", borderLeft: "1px solid #333", padding: 24, boxSizing: "border-box" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>Nouvel article</h2>
              <button onClick={() => setDrawerOpen(false)} style={{ background: "none", border: "none", color: "#888", fontSize: 20, cursor: "pointer" }}>
                &times;
              </button>
            </div>

            <form
              key={formKey}
              action={(fd) => {
                if (!drawerFamille) return;
                fd.set("famille", drawerFamille);
                fd.set("code", `${drawerFamille}-${codeSuffix.trim()}`);
                createAction(fd);
              }}
              style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Famille</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {FAMILLES.map((f) => (
                    <div
                      key={f.id}
                      onClick={() => setDrawerFamille(f.id)}
                      style={{ cursor: "pointer", borderRadius: 8, border: `1px solid ${drawerFamille === f.id ? "#3b82f6" : "#333"}`, background: drawerFamille === f.id ? "rgba(59,130,246,0.1)" : "transparent", padding: 10, fontSize: 12 }}
                    >
                      <div style={{ fontWeight: 700, color: "#fff" }}>
                        {f.id} · {f.short}
                      </div>
                      <div style={{ marginTop: 2, color: "#888" }}>{f.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {drawerFamille && (
                <>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Code</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={{ display: "flex", alignItems: "center", borderRadius: 8, border: "1px solid #333", background: "#151515", padding: "0 12px", fontSize: 13, color: "#888", fontFamily: "monospace" }}>{drawerFamille}-</span>
                      <input value={codeSuffix} onChange={(e) => setCodeSuffix(e.target.value)} placeholder="061" required style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Nom de l&apos;article</label>
                    <input name="nom" placeholder="Ex. Polo brodé Standard" required style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Prix de vente (F CFA)</label>
                    <input name="prixVente" type="number" min="0" step="1" placeholder="Ex. 9000" required style={inputStyle} />
                  </div>
                  {(drawerFamille === "C" || drawerFamille === "D") && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Prix de revient (optionnel)</label>
                        <button type="button" onClick={() => setCalcOpenFor("new")} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>🧮 Calculateur</button>
                      </div>
                      <input
                        name="prixRevient"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Ex. 5000"
                        value={newPrixRevientDraft}
                        onChange={(e) => setNewPrixRevientDraft(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  )}
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Branche</label>
                    <select name="brancheId" style={inputStyle}>
                      <option value="">Non catégorisé</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Photo (URL)</label>
                    <input name="photoUrl" placeholder="https:// (optionnel)" style={inputStyle} />
                  </div>
                  {drawerFamille === "A" && (
                    <div>
                      <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Type de marquage</label>
                      <select name="categorieMarquage" defaultValue="" style={inputStyle}>
                        <option value="">Non concerné</option>
                        <option value="ENSEMBLE">Ensemble (bascule haut + bas)</option>
                        <option value="TISSU">Tissu (zones ou toute la surface)</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#e0e0e0" }}>
                <input type="checkbox" name="publieBoutique" />
                Publier sur la boutique en ligne
              </label>

              {createState.error && <p style={{ fontSize: 12.5, color: "#f87171", margin: 0 }}>{createState.error}</p>}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #333", paddingTop: 14 }}>
                <button type="button" onClick={() => setDrawerOpen(false)} style={darkButton("#333", "#e0e0e0")}>
                  Annuler
                </button>
                <button type="submit" disabled={pending || !drawerFamille} style={darkButton("#3b82f6")}>
                  {pending ? "Création..." : "Créer l'article"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {calcOpenFor === "detail" && detailArticle && (
        <CoutCalculatorModal
          initial={(detailArticle.compositionCout as CompositionCout | null) ?? emptyComposition}
          onClose={() => setCalcOpenFor(null)}
          onSync={async (composition, prixRevient) => {
            await definirPrixRevientCalcule(detailArticle.id, composition);
            setDetailArticle({ ...detailArticle, pmp: prixRevient.toFixed(2), compositionCout: composition });
            setCalcOpenFor(null);
          }}
        />
      )}
      {calcOpenFor === "new" && (
        <CoutCalculatorModal
          initial={emptyComposition}
          onClose={() => setCalcOpenFor(null)}
          onSync={(_composition, prixRevient) => {
            setNewPrixRevientDraft(String(Math.round(prixRevient)));
            setCalcOpenFor(null);
          }}
        />
      )}
    </AppShell>
  );
}
