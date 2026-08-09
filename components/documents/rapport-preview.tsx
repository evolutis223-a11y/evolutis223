import { formatFcfa } from "@/lib/format";
import { commentaireFinance, commentaireOperations } from "@/lib/documents/rapport-commentaires";
import { MENTIONS_LEGALES_TEXTE } from "@/lib/documents/legal-mentions";
import type { RapportDocumentData } from "@/lib/documents/types";

// Aperçu HTML "à l'écran" du Rapport officiel — même patron visuel que DocumentPreview
// (components/documents/document-preview.tsx) : fond blanc, texte noir, Arial, logo en en-tête.
// Doit rester visuellement fidèle au PDF réel (lib/documents/rapport-document.tsx) sans être un
// rendu du PDF lui-même — décision utilisateur 2026-08-09 (même principe que Documents : aperçu
// HTML à gauche/droite, impression via le vrai PDF sur clic "Imprimer").

const LIVRAISON_STATUT_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  PRIS_EN_CHARGE: "Pris en charge",
  EN_ROUTE: "En route",
  LIVREE: "Livrée",
  ECHEC: "Échec",
};
const INCIDENT_TYPE_LABELS: Record<string, string> = {
  MALADIE: "Maladie",
  BLESSURE: "Blessure",
  DECES: "Décès",
  CATASTROPHE_NATURELLE: "Catastrophe naturelle",
  BLOCAGE_RECRUTEMENT: "Blocage de recrutement",
  AUTRE: "Autre",
};

function MiniBarChartHtml({ points }: { points: { label: string; a: number; b: number }[] }) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.a, p.b)));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90, borderBottom: "1px solid #000" }}>
        {points.map((p, i) => (
          <div key={i} style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 2, height: "100%" }}>
            <div style={{ width: 10, height: `${(p.a / max) * 100}%`, background: "#555" }} />
            <div style={{ width: 10, height: `${(p.b / max) * 100}%`, background: "#000" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {points.map((p, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9.5, color: "#666" }}>
            {p.label}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 10.5, color: "#444" }}>
        <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#555", marginRight: 4 }} />Chiffre d&apos;affaires</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#000", marginRight: 4 }} />Bénéfice net</span>
      </div>
    </div>
  );
}

const sectionTitle: React.CSSProperties = { fontSize: 14, fontWeight: 800, borderBottom: "1px solid #000", paddingBottom: 4, marginBottom: 10, marginTop: 22 };
const statLabel: React.CSSProperties = { fontSize: 9.5, color: "#666", textTransform: "uppercase" };
const statValue: React.CSSProperties = { fontSize: 19, fontWeight: 800, marginTop: 3 };
const tableRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #ddd", fontSize: 12.5 };

export function RapportPreview({ data }: { data: RapportDocumentData }) {
  const dateStr = (data.dateEmission ?? new Date()).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const tendancePoints = data.tendance.map((p) => ({ label: p.label, a: p.chiffreAffaires, b: p.beneficeNet }));

  return (
    <div style={{ background: "#fff", color: "#000", borderRadius: 6, padding: 28, fontFamily: "Arial,sans-serif", fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #000", paddingBottom: 12, marginBottom: 6 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" style={{ height: 42, width: "auto" }} />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Rapport d&apos;activité</div>
          <div style={{ fontSize: 10.5, color: "#444", marginTop: 3 }}>{data.periodeLabel} — émis le {dateStr}</div>
        </div>
      </div>

      <div style={sectionTitle}>Résumé exécutif</div>
      <div style={{ display: "flex", gap: 18 }}>
        <div style={{ flex: 1 }}>
          <div style={statLabel}>Chiffre d&apos;affaires</div>
          <div style={statValue}>{formatFcfa(data.finance.chiffreAffaires)}</div>
          {data.finance.variationCaPct !== null && (
            <div style={{ fontSize: 10.5, color: data.finance.variationCaPct >= 0 ? "#166534" : "#b91c1c", marginTop: 2 }}>
              {data.finance.variationCaPct >= 0 ? "▲" : "▼"} {Math.abs(data.finance.variationCaPct)}% vs période préc.
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={statLabel}>Bénéfice brut</div>
          <div style={statValue}>{formatFcfa(data.finance.beneficeBrut)}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={statLabel}>Bénéfice net</div>
          <div style={statValue}>{formatFcfa(data.finance.beneficeNet)}</div>
          {data.finance.variationBeneficeNetPct !== null && (
            <div style={{ fontSize: 10.5, color: data.finance.variationBeneficeNetPct >= 0 ? "#166534" : "#b91c1c", marginTop: 2 }}>
              {data.finance.variationBeneficeNetPct >= 0 ? "▲" : "▼"} {Math.abs(data.finance.variationBeneficeNetPct)}% vs période préc.
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={statLabel}>Ventes réalisées</div>
          <div style={statValue}>{data.finance.nombreVentes}</div>
        </div>
      </div>
      <div style={{ fontSize: 11.5, fontStyle: "italic", color: "#333", margin: "10px 0" }}>{commentaireFinance(data.finance)}</div>
      <MiniBarChartHtml points={tendancePoints} />

      <div style={sectionTitle}>Finance — détail</div>
      <div style={tableRow}><span>Coût d&apos;achat des ventes (PMP courant)</span><span>{formatFcfa(data.finance.coutAchatVentes)}</span></div>
      <div style={tableRow}><span>Dépenses / charges validées</span><span>{formatFcfa(data.finance.depensesCharges)}</span></div>
      <div style={tableRow}><span>Commissions payées</span><span>{formatFcfa(data.finance.commissions)}</span></div>

      <div style={sectionTitle}>Ressources humaines</div>
      <div style={{ display: "flex", gap: 18, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={statLabel}>Effectif actif</div>
          <div style={statValue}>{data.rh.effectifActif}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={statLabel}>Masse salariale payée</div>
          <div style={statValue}>{formatFcfa(data.rh.masseSalariale)}</div>
          {data.rh.variationMassePct !== null && (
            <div style={{ fontSize: 10.5, color: data.rh.variationMassePct >= 0 ? "#166534" : "#b91c1c", marginTop: 2 }}>
              {data.rh.variationMassePct >= 0 ? "▲" : "▼"} {Math.abs(data.rh.variationMassePct)}% vs période préc.
            </div>
          )}
        </div>
      </div>
      {data.rh.incidents.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Incidents personnel</div>
          {data.rh.incidents.map((inc, i) => (
            <div key={i} style={tableRow}><span>{INCIDENT_TYPE_LABELS[inc.type] ?? inc.type}</span><span>{inc.nombre}</span></div>
          ))}
        </>
      )}
      {data.rh.besoinsActifs.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 10, marginBottom: 4 }}>Besoins de personnel planifiés</div>
          {data.rh.besoinsActifs.map((b, i) => (
            <div key={i} style={tableRow}>
              <span>{b.titre} — {b.nombrePersonnesRequis} pers.</span>
              <span>{b.periodeDebut} → {b.periodeFin}</span>
            </div>
          ))}
        </>
      )}

      <div style={sectionTitle}>Opérations — livraisons &amp; stock</div>
      <div style={{ display: "flex", gap: 18 }}>
        <div style={{ flex: 1 }}>
          <div style={statLabel}>Livraisons (période)</div>
          <div style={statValue}>{data.operations.totalLivraisons}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={statLabel}>En rupture (actuel)</div>
          <div style={statValue}>{data.operations.ruptureActuelle}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={statLabel}>Stock faible (actuel)</div>
          <div style={statValue}>{data.operations.stockFaibleActuel}</div>
        </div>
      </div>
      <div style={{ fontSize: 11.5, fontStyle: "italic", color: "#333", margin: "10px 0" }}>{commentaireOperations(data.operations)}</div>
      {data.operations.livraisonsParStatut.map((l) => (
        <div key={l.statut} style={tableRow}><span>{LIVRAISON_STATUT_LABELS[l.statut] ?? l.statut}</span><span>{l.nombre}</span></div>
      ))}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40 }}>
        <div>
          <div style={{ fontStyle: "italic", fontWeight: 700, textDecoration: "underline", fontSize: 12 }}>Établi par</div>
          <div style={{ marginTop: 36, borderTop: "1px solid #000", width: 170 }} />
        </div>
        <div>
          <div style={{ fontStyle: "italic", fontWeight: 700, textDecoration: "underline", fontSize: 12, textAlign: "right" }}>EVOLUTIS223 — Direction</div>
          <div style={{ marginTop: 36, borderTop: "1px solid #000", width: 170 }} />
        </div>
      </div>

      <div style={{ borderTop: "1px solid #000", paddingTop: 8, marginTop: 20, textAlign: "center", fontSize: 8.5, color: "#333" }}>
        {MENTIONS_LEGALES_TEXTE}
      </div>
    </div>
  );
}
