// Générateur PDF du Reçu de caisse (§13 du cahier des charges — A5 paysage, le plus
// petit des 6 modèles, construit et vérifié en premier avant de généraliser).
// Mise en page basée sur design/Modele Recu Caisse Boutique.dc.html (export statique
// Claude Design, structure/contenu réutilisés, pas le DOM littéral).

import React from "react";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { ASSET_BUFFERS } from "./assets";
import { formatDateHeure, formatFcfa } from "./format";
import { sha256Hex } from "./hash";
import { MENTIONS_LEGALES_TEXTE } from "./legal-mentions";
import { generateQrPngDataUrl, suiviPayloadProvisoire } from "./qr";
import type { DocumentGenere, ModeReglement, RecuCaisseData } from "./types";

const LIBELLE_MODE_REGLEMENT: Record<ModeReglement, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  VIREMENT: "Virement",
  CARTE: "Carte",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 26,
    paddingBottom: 20,
    paddingHorizontal: 30,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: "#000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#000",
    paddingBottom: 10,
    marginBottom: 14,
  },
  logo: {
    width: 90,
    height: 26,
    objectFit: "contain",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
  },
  subtitle: {
    fontSize: 8.5,
    color: "#444",
    marginTop: 2,
  },
  table: {
    marginBottom: 12,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#000",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  th: {
    color: "#fff",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    padding: 5,
  },
  td: {
    fontSize: 9.5,
    padding: 6,
  },
  colNum: { flex: 0.4, textAlign: "center" },
  colArticle: { flex: 3 },
  colQte: { flex: 1, textAlign: "center" },
  colPu: { flex: 1.3, textAlign: "right" },
  colTotal: { flex: 1.4, textAlign: "right" },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  summaryLeftLine: {
    fontSize: 9,
    marginBottom: 5,
  },
  summaryRight: {
    width: 190,
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1.5,
    fontSize: 9,
  },
  totalTtcLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 2,
    borderTopColor: "#000",
    marginTop: 3,
    paddingTop: 3,
    fontFamily: "Helvetica-Bold",
    fontSize: 11.5,
  },
  reliquatLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  spacer: {
    flexGrow: 1,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  merci: {
    fontSize: 9,
    fontStyle: "italic",
    color: "#333",
  },
  cachet: {
    width: 52,
    height: 52,
    opacity: 0.88,
  },
  footerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  qr: {
    width: 42,
    height: 42,
    marginLeft: 10,
  },
  legalMentions: {
    borderTopWidth: 1,
    borderTopColor: "#000",
    paddingTop: 5,
    fontSize: 6.6,
    color: "#333",
    textAlign: "center",
  },
});

interface RecuCaisseNormalise
  extends Required<Omit<RecuCaisseData, "dateEmission" | "qrPayload">> {
  dateEmission: Date;
  qrPayload?: string;
}

function normaliser(data: RecuCaisseData): RecuCaisseNormalise {
  const sousTotalHt = data.sousTotalHt ?? data.lignes.reduce((acc, l) => acc + l.total, 0);
  const remise = data.remise ?? 0;
  const tva = data.tva ?? 0;
  const reliquat = data.reliquat ?? Math.max(0, data.montantRecu - data.totalTtc);
  return {
    ...data,
    dateEmission: data.dateEmission ?? new Date(),
    sousTotalHt,
    remise,
    tva,
    reliquat,
  };
}

export function RecuCaisseDocument({
  data,
  qrDataUrl,
}: {
  data: RecuCaisseData;
  /** Data URL PNG du QR, déjà généré (voir generateRecuCaissePdf — QRCode.toDataURL est async,
   * ne peut pas être appelé depuis ce composant synchrone). */
  qrDataUrl: string;
}) {
  const d = normaliser(data);

  return (
    <Document>
      <Page size="A5" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Image src={ASSET_BUFFERS.logo} style={styles.logo} />
          <View style={styles.headerRight}>
            <Text style={styles.title}>Reçu de caisse</Text>
            <Text style={styles.subtitle}>
              {`N° ${d.numero} — ${formatDateHeure(d.dateEmission)}`}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colNum]}>N°</Text>
            <Text style={[styles.th, styles.colArticle]}>Article</Text>
            <Text style={[styles.th, styles.colQte]}>Qté</Text>
            <Text style={[styles.th, styles.colPu]}>PU</Text>
            <Text style={[styles.th, styles.colTotal]}>Total</Text>
          </View>
          {d.lignes.map((ligne, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.td, styles.colNum]}>{i + 1}</Text>
              <Text style={[styles.td, styles.colArticle]}>{ligne.designation}</Text>
              <Text style={[styles.td, styles.colQte]}>{ligne.quantite}</Text>
              <Text style={[styles.td, styles.colPu]}>{formatFcfa(ligne.prixUnitaire)}</Text>
              <Text style={[styles.td, styles.colTotal]}>{formatFcfa(ligne.total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLeftLine}>
              <Text style={styles.bold}>Mode de règlement : </Text>
              {LIBELLE_MODE_REGLEMENT[d.modeReglement]}
            </Text>
            <Text style={styles.summaryLeftLine}>
              <Text style={styles.bold}>Reçu par : </Text>
              {d.recuPar}
            </Text>
          </View>
          <View style={styles.summaryRight}>
            <View style={styles.summaryLine}>
              <Text>SOUS-TOTAL HT</Text>
              <Text>{formatFcfa(d.sousTotalHt)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text>REMISE</Text>
              <Text>{formatFcfa(d.remise)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text>TVA</Text>
              <Text>{formatFcfa(d.tva)}</Text>
            </View>
            <View style={styles.totalTtcLine}>
              <Text>TOTAL TTC</Text>
              <Text>{formatFcfa(d.totalTtc)}</Text>
            </View>
            <View style={[styles.summaryLine, { marginTop: 4 }]}>
              <Text>Montant reçu</Text>
              <Text>{formatFcfa(d.montantRecu)}</Text>
            </View>
            <View style={styles.reliquatLine}>
              <Text>Reliquat dû au client</Text>
              <Text>{formatFcfa(d.reliquat)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.spacer} />

        <View style={styles.footer}>
          <Text style={styles.merci}>Merci pour votre confiance.</Text>
          <View style={styles.footerRight}>
            <Image src={ASSET_BUFFERS.cachet} style={styles.cachet} />
            <Image src={qrDataUrl} style={styles.qr} />
          </View>
        </View>

        <Text style={styles.legalMentions}>{MENTIONS_LEGALES_TEXTE}</Text>
      </Page>
    </Document>
  );
}

/**
 * Génère le PDF du Reçu de caisse et son empreinte SHA-256.
 * `data` reste un objet simple (voir types.ts) — aucun accès base de données ici,
 * c'est à l'appelant de fournir des valeurs déjà résolues (lignes, totaux, etc.).
 */
export async function generateRecuCaissePdf(data: RecuCaisseData): Promise<DocumentGenere> {
  const qrDataUrl = await generateQrPngDataUrl(
    data.qrPayload ?? suiviPayloadProvisoire(data.numero)
  );
  const buffer = await renderToBuffer(
    <RecuCaisseDocument data={data} qrDataUrl={qrDataUrl} />
  );
  return { buffer, hashSha256: sha256Hex(buffer) };
}
