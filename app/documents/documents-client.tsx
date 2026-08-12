"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell, type ShellModule } from "@/components/app-shell";
import { AideBulle } from "@/components/ui/aide-bulle";
import { formatFcfa } from "@/lib/format";
import { DocumentPreview, type DocumentPreviewData } from "@/components/documents/document-preview";

type Article = { id: number; nom: string };
type Variante = { id: number; taille: string | null; couleur: string | null };
type Ligne = { id: number; affaireId: number; articleId: number; varianteId: number | null; quantite: number; prixUnitaire: string };
type Reglement = { id: number; affaireId: number | null; montant: string };
type Livraison = { affaireId: number; adresse: string | null };
type AffaireRow = {
  id: number;
  numero: string;
  type: string;
  immuable: boolean;
  dateCreation: Date;
  objet: string | null;
  provenance: string | null;
  modeFinalisation: string | null;
  tvaPct: string | null;
  remiseMontant: string | null;
  remiseUnite: string | null;
  montantTtc: string;
  infosComplementaires: string | null;
  mentionValidite: string | null;
  acomptePct: string | null;
  clientNom: string;
  clientAdresse: string | null;
  clientTelephone: string | null;
  commercialNom: string;
};

const TYPE_LABEL: Record<string, string> = { FACTURE: "Facture", DEVIS: "Devis", PROFORMA: "Proforma", BON_COMMANDE: "Bon de commande", TICKET: "Reçu" };
const TYPE_FILTERS = [
  { v: "", l: "Tous" },
  { v: "FACTURE", l: "Facture" },
  { v: "DEVIS", l: "Devis" },
  { v: "PROFORMA", l: "Proforma" },
  { v: "BON_COMMANDE", l: "Bon de commande" },
  { v: "TICKET", l: "Reçu" },
];

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("fr-FR");
}

export function DocumentsClient({
  userName,
  roleLibelle,
  modules,
  affaires,
  lignes,
  reglements,
  livraisons,
  articles,
  variantes,
  masthead,
  mentionsValidite,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  affaires: AffaireRow[];
  lignes: Ligne[];
  reglements: Reglement[];
  livraisons: Livraison[];
  articles: Article[];
  variantes: Variante[];
  masthead: string;
  mentionsValidite: Record<string, string>;
}) {
  // Pré-rempli depuis la recherche globale de la barre du haut (components/app-shell.tsx),
  // qui redirige ici avec ?q=... — un seul champ de recherche pour tout le monde en pratique.
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [typeFiltre, setTypeFiltre] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const lignesByAffaire = useMemo(() => {
    const m = new Map<number, Ligne[]>();
    for (const l of lignes) {
      if (!m.has(l.affaireId)) m.set(l.affaireId, []);
      m.get(l.affaireId)!.push(l);
    }
    return m;
  }, [lignes]);
  const regleByAffaire = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of reglements) {
      if (r.affaireId == null) continue;
      m.set(r.affaireId, (m.get(r.affaireId) ?? 0) + Number(r.montant));
    }
    return m;
  }, [reglements]);
  const livraisonByAffaire = useMemo(() => {
    const m = new Map<number, string | null>();
    for (const l of livraisons) if (!m.has(l.affaireId)) m.set(l.affaireId, l.adresse);
    return m;
  }, [livraisons]);

  const filtres = useMemo(() => {
    const q = search.trim().toLowerCase();
    return affaires.filter(
      (a) =>
        (!q || a.numero.toLowerCase().includes(q) || a.clientNom.toLowerCase().includes(q) || (a.objet ?? "").toLowerCase().includes(q)) &&
        (!typeFiltre || a.type === typeFiltre)
    );
  }, [affaires, search, typeFiltre]);

  const selected = affaires.find((a) => a.id === selectedId) ?? null;

  const stats = useMemo(() => {
    const parType: Record<string, number> = {};
    for (const a of affaires) parType[a.type] = (parType[a.type] ?? 0) + 1;
    return parType;
  }, [affaires]);

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Documents" modules={modules}>
      <div style={{ display: "flex", gap: 20, padding: 20, height: "calc(100vh - 118px)", boxSizing: "border-box" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Documents</div>
            <AideBulle titre="Comment utiliser Documents">
              <p>
                Les archives de toutes les affaires (devis, proforma, factures, reçus...) déjà créées ailleurs — rien ne se crée ici, c&apos;est une recherche pour retrouver et réimprimer un document.
              </p>
              <p>Filtre par type de document, ou cherche par numéro, client ou objet.</p>
            </AideBulle>
          </div>
          <input placeholder="Rechercher (n°, client, objet)..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ background: "#121212", border: "1px solid #333", color: "#e0e0e0", padding: "10px 12px", borderRadius: 8, fontSize: 14, marginBottom: 10, boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {TYPE_FILTERS.map((opt) => (
              <button
                key={opt.v}
                onClick={() => setTypeFiltre(opt.v)}
                style={{
                  background: typeFiltre === opt.v ? "#3b82f6" : "#1e1e1e",
                  color: typeFiltre === opt.v ? "#fff" : "#ccc",
                  border: "1px solid #333",
                  padding: "7px 12px",
                  borderRadius: 20,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {opt.l}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, border: "1px solid #262626", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th style={{ width: "20%", padding: 10, borderBottom: "1px solid #333", textAlign: "left", color: "#888", fontSize: 11.5, position: "sticky", top: 0, background: "#151515" }}>Type</th>
                  <th style={{ width: "20%", padding: 10, borderBottom: "1px solid #333", textAlign: "left", color: "#888", fontSize: 11.5, position: "sticky", top: 0, background: "#151515" }}>N°</th>
                  <th style={{ width: "20%", padding: 10, borderBottom: "1px solid #333", textAlign: "left", color: "#888", fontSize: 11.5, position: "sticky", top: 0, background: "#151515" }}>Date</th>
                  <th style={{ width: "40%", padding: 10, borderBottom: "1px solid #333", textAlign: "left", color: "#888", fontSize: 11.5, position: "sticky", top: 0, background: "#151515" }}>Client</th>
                </tr>
              </thead>
              <tbody>
                {filtres.map((a) => (
                  <tr key={a.id} onClick={() => setSelectedId(a.id)} style={{ cursor: "pointer", background: selectedId === a.id ? "#263041" : "transparent" }}>
                    <td style={{ padding: 10, borderBottom: "1px solid #262626", fontSize: 12.5, color: "#888" }}>{TYPE_LABEL[a.type] ?? a.type}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #262626", fontSize: 12.5, color: "#e0e0e0" }}>{a.numero}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #262626", fontSize: 12.5, color: "#888" }}>{formatDate(a.dateCreation)}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #262626", fontSize: 12.5, color: "#e0e0e0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.clientNom}</td>
                  </tr>
                ))}
                {filtres.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#666", fontSize: 13 }}>
                      Aucun document.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {!selected ? (
            <div style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: 28, flex: 1, overflowY: "auto" }}>
              <div style={{ fontSize: 13, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>
                Aperçu — cliquez sur un document pour l&apos;afficher
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
                  <span style={{ color: "#888", fontSize: 13 }}>Total documents</span>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>{affaires.length}</div>
                </div>
                {TYPE_FILTERS.slice(1).map((t) => (
                  <div key={t.v} style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
                    <span style={{ color: "#888", fontSize: 13 }}>{t.l}</span>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981" }}>{stats[t.v] ?? 0}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            (() => {
              const lignesAff = lignesByAffaire.get(selected.id) ?? [];
              const totalRegle = regleByAffaire.get(selected.id) ?? 0;
              const data: DocumentPreviewData = {
                type: selected.type,
                numero: selected.numero,
                dateCreation: selected.dateCreation,
                immuable: selected.immuable,
                objet: selected.objet,
                clientNom: selected.clientNom,
                clientAdresse: selected.clientAdresse,
                clientTelephone: selected.clientTelephone,
                commercialNom: selected.commercialNom,
                provenance: selected.provenance,
                modeFinalisation: selected.modeFinalisation,
                adresseLivraison: livraisonByAffaire.get(selected.id) ?? null,
                tvaPct: selected.tvaPct ? Number(selected.tvaPct) : null,
                remiseMontant: selected.remiseMontant ? Number(selected.remiseMontant) : null,
                remiseUnite: selected.remiseUnite,
                montantTtc: Number(selected.montantTtc),
                montantRegle: totalRegle,
                infosComplementaires: selected.infosComplementaires,
                mentionValidite: selected.mentionValidite || mentionsValidite[selected.type] || null,
                acomptePct: selected.acomptePct != null ? Number(selected.acomptePct) : null,
                lignes: lignesAff.map((l) => {
                  const art = articles.find((x) => x.id === l.articleId);
                  const vnt = variantes.find((v) => v.id === l.varianteId);
                  return { nom: `${art?.nom ?? ""}${vnt ? ` — ${vnt.taille ?? ""} ${vnt.couleur ?? ""}` : ""}`, qte: l.quantite, pu: Number(l.prixUnitaire) };
                }),
              };
              return (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Aperçu {TYPE_LABEL[selected.type] ?? selected.type}</div>
                    <a
                      href={`/api/documents/affaire/${selected.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ background: "#3b82f6", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 6, fontSize: 13, fontWeight: 700, textDecoration: "none" }}
                    >
                      🖨️ Imprimer
                    </a>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                    <DocumentPreview data={data} masthead={masthead} />
                    {Number(selected.montantTtc) - totalRegle > 0 && selected.immuable && (
                      <div style={{ marginTop: 14 }}>
                        <a
                          href={`/reglements?affaire=${selected.id}`}
                          style={{ background: "#10b981", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 6, fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-block" }}
                        >
                          💰 Aller au paiement
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>
    </AppShell>
  );
}
