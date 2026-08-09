// Générateur PDF "Rapport officiel" (2026-08-09, demande utilisateur) — même patron que
// affaire-document.tsx : en-tête logo + ENTREPRISE, mentions légales en pied de page. Pensé pour
// être un vrai document administratif (dossier bancaire, partenariat), pas un export technique :
// résumé exécutif avec graphique, puis chaque section avec ses propres chiffres et un court
// commentaire qui s'adapte aux résultats (phrases conditionnelles simples — pas de génération par
// IA, volontairement, pour rester prévisible et vérifiable).

import React from "react";
import { Document, Image, Line, Page, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { ASSET_BUFFERS } from "./assets";
import { formatFcfa } from "./format";
import { sha256Hex } from "./hash";
import { MENTIONS_LEGALES_TEXTE } from "./legal-mentions";
import type { DocumentGenere, RapportDocumentData } from "./types";

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

const styles = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 30, paddingHorizontal: 30, fontSize: 9.5, fontFamily: "Helvetica", color: "#000" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 2, borderBottomColor: "#000", paddingBottom: 10, marginBottom: 14 },
  logo: { width: 100, height: 29, objectFit: "contain" },
  headerRight: { textAlign: "right" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 8.5, color: "#444", marginTop: 3 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 8, borderBottomWidth: 1, borderBottomColor: "#000", paddingBottom: 3 },
  statsRow: { flexDirection: "row", marginBottom: 8 },
  statBlock: { flex: 1, marginRight: 10 },
  statLabel: { fontSize: 7.5, color: "#666", textTransform: "uppercase" },
  statValue: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 2 },
  statVariation: { fontSize: 7.5, marginTop: 2 },
  commentaire: { fontSize: 9, color: "#333", lineHeight: 1.5, marginTop: 6, marginBottom: 4, fontFamily: "Helvetica-Oblique" },
  table: { marginTop: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ccc", paddingVertical: 3 },
  tableLabel: { flex: 2, fontSize: 9 },
  tableValue: { flex: 1, fontSize: 9, textAlign: "right" },
  chartWrap: { marginTop: 8, marginBottom: 4 },
  legend: { flexDirection: "row", marginTop: 4, gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", fontSize: 7.5, color: "#444" },
  legendSwatch: { width: 6, height: 6, marginRight: 4 },
  signatures: { flexDirection: "row", justifyContent: "space-between", marginTop: 30 },
  signatureLabel: { fontSize: 10, fontFamily: "Helvetica-BoldOblique", textDecoration: "underline" },
  signatureLine: { marginTop: 36, borderTopWidth: 1, borderTopColor: "#000", width: 170 },
  legalMentions: { position: "absolute", bottom: 16, left: 30, right: 30, borderTopWidth: 1, borderTopColor: "#000", paddingTop: 5, fontSize: 6.6, color: "#333", textAlign: "center" },
});

function BarChart({ points, width = 500, height = 90 }: { points: { label: string; a: number; b: number }[]; width?: number; height?: number }) {
  if (points.length === 0) return null;
  const groupW = width / points.length;
  const max = Math.max(1, ...points.map((p) => Math.max(p.a, p.b)));
  const barW = Math.min(16, groupW * 0.3);
  return (
    <View style={styles.chartWrap}>
      <Svg width={width} height={height + 14} viewBox={`0 0 ${width} ${height + 14}`}>
        <Line x1={0} y1={height} x2={width} y2={height} stroke="#000" strokeWidth={0.5} />
        {points.map((p, i) => {
          const cx = i * groupW + groupW / 2;
          const hA = (p.a / max) * (height - 6);
          const hB = (p.b / max) * (height - 6);
          return (
            <React.Fragment key={i}>
              <Rect x={cx - barW - 1} y={height - hA} width={barW} height={hA} fill="#555" />
              <Rect x={cx + 1} y={height - hB} width={barW} height={hB} fill="#000" />
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row" }}>
        {points.map((p, i) => (
          <Text key={i} style={{ flex: 1, fontSize: 6.5, textAlign: "center", color: "#666" }}>
            {p.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function commentaireFinance(f: RapportDocumentData["finance"]): string {
  if (f.beneficeNet < 0) {
    return `La période affiche un résultat net négatif de ${formatFcfa(Math.abs(f.beneficeNet))} : les achats, charges et commissions ont dépassé le chiffre d'affaires réalisé.`;
  }
  if (f.variationBeneficeNetPct !== null && f.variationBeneficeNetPct >= 10) {
    return `Le bénéfice net progresse de ${f.variationBeneficeNetPct}% par rapport à la période précédente, une évolution favorable.`;
  }
  if (f.variationBeneficeNetPct !== null && f.variationBeneficeNetPct <= -10) {
    return `Le bénéfice net recule de ${Math.abs(f.variationBeneficeNetPct)}% par rapport à la période précédente — à surveiller.`;
  }
  return `Le résultat net de la période est positif et globalement stable par rapport à la période précédente.`;
}

function commentaireOperations(o: RapportDocumentData["operations"]): string {
  if (o.ruptureActuelle === 0) return "Aucune rupture de stock n'est constatée à la date d'émission de ce rapport.";
  if (o.ruptureActuelle <= 2) return `${o.ruptureActuelle} article(s) sont actuellement en rupture de stock — point de vigilance.`;
  return `${o.ruptureActuelle} articles sont actuellement en rupture de stock — un réapprovisionnement rapide est recommandé.`;
}

export function RapportDocument({ data }: { data: RapportDocumentData }) {
  const dateEmission = data.dateEmission ?? new Date();
  const dateStr = dateEmission.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const tendancePoints = data.tendance.map((p) => ({ label: p.label, a: p.chiffreAffaires, b: p.beneficeNet }));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Image src={ASSET_BUFFERS.logo} style={styles.logo} />
          <View style={styles.headerRight}>
            <Text style={styles.title}>Rapport d&apos;activité</Text>
            <Text style={styles.subtitle}>{data.periodeLabel} — émis le {dateStr}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Résumé exécutif</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Chiffre d&apos;affaires</Text>
              <Text style={styles.statValue}>{formatFcfa(data.finance.chiffreAffaires)}</Text>
              {data.finance.variationCaPct !== null && (
                <Text style={styles.statVariation}>{data.finance.variationCaPct >= 0 ? "+" : ""}{data.finance.variationCaPct}% vs période préc.</Text>
              )}
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Bénéfice brut</Text>
              <Text style={styles.statValue}>{formatFcfa(data.finance.beneficeBrut)}</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Bénéfice net</Text>
              <Text style={styles.statValue}>{formatFcfa(data.finance.beneficeNet)}</Text>
              {data.finance.variationBeneficeNetPct !== null && (
                <Text style={styles.statVariation}>{data.finance.variationBeneficeNetPct >= 0 ? "+" : ""}{data.finance.variationBeneficeNetPct}% vs période préc.</Text>
              )}
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Ventes réalisées</Text>
              <Text style={styles.statValue}>{data.finance.nombreVentes}</Text>
            </View>
          </View>
          <Text style={styles.commentaire}>{commentaireFinance(data.finance)}</Text>
          <BarChart points={tendancePoints} />
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: "#555" }]} />
              <Text>Chiffre d&apos;affaires</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: "#000" }]} />
              <Text>Bénéfice net</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Finance — détail</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Coût d&apos;achat des ventes (PMP courant)</Text>
              <Text style={styles.tableValue}>{formatFcfa(data.finance.coutAchatVentes)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Dépenses / charges validées</Text>
              <Text style={styles.tableValue}>{formatFcfa(data.finance.depensesCharges)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Commissions payées</Text>
              <Text style={styles.tableValue}>{formatFcfa(data.finance.commissions)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ressources humaines</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Effectif actif</Text>
              <Text style={styles.statValue}>{data.rh.effectifActif}</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Masse salariale payée</Text>
              <Text style={styles.statValue}>{formatFcfa(data.rh.masseSalariale)}</Text>
              {data.rh.variationMassePct !== null && (
                <Text style={styles.statVariation}>{data.rh.variationMassePct >= 0 ? "+" : ""}{data.rh.variationMassePct}% vs période préc.</Text>
              )}
            </View>
          </View>
          {data.rh.incidents.length > 0 && (
            <View style={styles.table}>
              <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", marginBottom: 3 }}>Incidents personnel</Text>
              {data.rh.incidents.map((inc, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.tableLabel}>{INCIDENT_TYPE_LABELS[inc.type] ?? inc.type}</Text>
                  <Text style={styles.tableValue}>{inc.nombre}</Text>
                </View>
              ))}
            </View>
          )}
          {data.rh.besoinsActifs.length > 0 && (
            <View style={styles.table}>
              <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", marginBottom: 3, marginTop: 6 }}>Besoins de personnel planifiés</Text>
              {data.rh.besoinsActifs.map((b, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.tableLabel}>{b.titre} — {b.nombrePersonnesRequis} pers.</Text>
                  <Text style={styles.tableValue}>{b.periodeDebut} → {b.periodeFin}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Opérations — livraisons &amp; stock</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Livraisons (période)</Text>
              <Text style={styles.statValue}>{data.operations.totalLivraisons}</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>En rupture (actuel)</Text>
              <Text style={styles.statValue}>{data.operations.ruptureActuelle}</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Stock faible (actuel)</Text>
              <Text style={styles.statValue}>{data.operations.stockFaibleActuel}</Text>
            </View>
          </View>
          <Text style={styles.commentaire}>{commentaireOperations(data.operations)}</Text>
          {data.operations.livraisonsParStatut.length > 0 && (
            <View style={styles.table}>
              {data.operations.livraisonsParStatut.map((l) => (
                <View key={l.statut} style={styles.tableRow}>
                  <Text style={styles.tableLabel}>{LIVRAISON_STATUT_LABELS[l.statut] ?? l.statut}</Text>
                  <Text style={styles.tableValue}>{l.nombre}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.signatures}>
          <View>
            <Text style={styles.signatureLabel}>Établi par</Text>
            <View style={styles.signatureLine} />
          </View>
          <View>
            <Text style={styles.signatureLabel}>EVOLUTIS223 — Direction</Text>
            <View style={styles.signatureLine} />
          </View>
        </View>

        <Text style={styles.legalMentions} fixed>{MENTIONS_LEGALES_TEXTE}</Text>
      </Page>
    </Document>
  );
}

export async function generateRapportPdf(data: RapportDocumentData): Promise<DocumentGenere> {
  const buffer = await renderToBuffer(<RapportDocument data={data} />);
  return { buffer, hashSha256: sha256Hex(buffer) };
}
