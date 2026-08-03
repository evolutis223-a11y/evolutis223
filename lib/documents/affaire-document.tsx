// Générateur PDF Facture / Devis / Proforma / Bon de commande (§13) — les quatre partagent la
// même structure (client, lignes, TVA, remise, total, solde) dans la maquette d'origine ; seul
// le titre et la mention de validité (Devis/Proforma) changent. Même patron que bon-livraison.tsx.
// Écart assumé : la maquette proposait un sélecteur de docType direct dans "+ Nouvelle affaire" —
// remplacé par affaires.type (§8.1, la commande passe toujours par le contrôle de stock avant de
// devenir un document imprimable) ; ce générateur imprime l'affaire telle qu'elle existe déjà.

import React from "react";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { ASSET_BUFFERS } from "./assets";
import { formatDateHeure, formatFcfa } from "./format";
import { sha256Hex } from "./hash";
import { MENTIONS_LEGALES_TEXTE } from "./legal-mentions";
import { chargerParametresAffaireDocument, type ParametresAffaireDocument } from "./parametres";
import { generateQrPngDataUrl, suiviPayloadProvisoire } from "./qr";
import type { AffaireDocumentData, DocumentGenere } from "./types";

const TITRES: Record<AffaireDocumentData["docType"], string> = {
  FACTURE: "Facture",
  DEVIS: "Devis",
  PROFORMA: "Proforma",
  BON_COMMANDE: "Bon de commande",
};

const styles = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 20, paddingHorizontal: 30, fontSize: 9.5, fontFamily: "Helvetica", color: "#000" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 2, borderBottomColor: "#000", paddingBottom: 10, marginBottom: 14 },
  logo: { width: 100, height: 29, objectFit: "contain" },
  headerRight: { flexDirection: "row", alignItems: "center" },
  headerCenter: { textAlign: "center", marginRight: 14 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 8.5, color: "#444", marginTop: 3 },
  validite: { marginTop: 4, alignSelf: "center", fontSize: 7.5, color: "#444" },
  qr: { width: 48, height: 48 },
  infoRow: { flexDirection: "row", marginBottom: 12 },
  infoBlock: { flex: 1, fontSize: 10 },
  infoLine: { marginBottom: 3 },
  bold: { fontFamily: "Helvetica-Bold" },
  table: { marginBottom: 12 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#000" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ddd" },
  th: { color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 9, padding: 5 },
  td: { fontSize: 9.5, padding: 6 },
  colDesignation: { flex: 4 },
  colQte: { flex: 1, textAlign: "center" },
  colPu: { flex: 1.4, textAlign: "right" },
  colTotal: { flex: 1.4, textAlign: "right" },
  totaux: { alignSelf: "flex-end", width: 220, marginBottom: 16 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalRowFinal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderTopWidth: 1, borderTopColor: "#000", marginTop: 2 },
  totalLabel: { fontSize: 9.5 },
  totalLabelFinal: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  infosComplementaires: { fontSize: 9.5, marginBottom: 16 },
  spacer: { flexGrow: 1 },
  signatures: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  signatureLabel: { fontSize: 11, fontFamily: "Helvetica-BoldOblique", textDecoration: "underline" },
  signatureLine: { marginTop: 40, borderTopWidth: 1, borderTopColor: "#000", width: 170 },
  legalMentions: { borderTopWidth: 1, borderTopColor: "#000", paddingTop: 5, fontSize: 6.6, color: "#333", textAlign: "center" },
});

function normaliser(data: AffaireDocumentData) {
  return { ...data, dateEmission: data.dateEmission ?? new Date() };
}

export function AffaireDocumentDocument({
  data,
  qrDataUrl,
  parametres,
}: {
  data: AffaireDocumentData;
  qrDataUrl: string;
  parametres: ParametresAffaireDocument;
}) {
  const d = normaliser(data);
  const sousTotal = d.lignes.reduce((s, l) => s + l.total, 0);
  const remiseValeur = !d.remiseMontant
    ? 0
    : d.remiseUnite === "%"
      ? sousTotal * (d.remiseMontant / 100)
      : d.remiseMontant;
  const apresRemise = Math.max(0, sousTotal - remiseValeur);
  const tvaValeur = d.tvaPct ? apresRemise * (d.tvaPct / 100) : 0;
  const solde = Math.max(0, d.montantTtc - (d.montantRecu ?? 0));
  const estDevisOuProforma = d.docType === "DEVIS" || d.docType === "PROFORMA";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={ASSET_BUFFERS.logo} style={styles.logo} />
          <View style={styles.headerRight}>
            <View style={styles.headerCenter}>
              <Text style={styles.title}>{TITRES[d.docType]}</Text>
              <Text style={styles.subtitle}>{`N° ${d.numero} — ${formatDateHeure(d.dateEmission)}`}</Text>
              {estDevisOuProforma && <Text style={styles.validite}>{parametres.mentionValidite}</Text>}
            </View>
            <Image src={qrDataUrl} style={styles.qr} />
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            {d.objet && (
              <Text style={styles.infoLine}>
                <Text style={styles.bold}>Objet : </Text>
                {d.objet}
              </Text>
            )}
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLine}>
              <Text style={styles.bold}>Client : </Text>
              {d.clientNom}
            </Text>
            {d.clientContact && <Text style={styles.infoLine}>Contact : {d.clientContact}</Text>}
            {d.clientAdresse && <Text style={styles.infoLine}>Adresse : {d.clientAdresse}</Text>}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colDesignation]}>Désignation</Text>
            <Text style={[styles.th, styles.colQte]}>Qté</Text>
            <Text style={[styles.th, styles.colPu]}>Prix unitaire</Text>
            <Text style={[styles.th, styles.colTotal]}>Total</Text>
          </View>
          {d.lignes.map((ligne, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.td, styles.colDesignation]}>{ligne.designation}</Text>
              <Text style={[styles.td, styles.colQte]}>{ligne.quantite}</Text>
              <Text style={[styles.td, styles.colPu]}>{formatFcfa(ligne.prixUnitaire)}</Text>
              <Text style={[styles.td, styles.colTotal]}>{formatFcfa(ligne.total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totaux}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Sous-total</Text>
            <Text style={styles.totalLabel}>{formatFcfa(sousTotal)}</Text>
          </View>
          {remiseValeur > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Remise</Text>
              <Text style={styles.totalLabel}>-{formatFcfa(remiseValeur)}</Text>
            </View>
          )}
          {tvaValeur > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{`TVA (${d.tvaPct}%)`}</Text>
              <Text style={styles.totalLabel}>{formatFcfa(tvaValeur)}</Text>
            </View>
          )}
          <View style={styles.totalRowFinal}>
            <Text style={styles.totalLabelFinal}>Total TTC</Text>
            <Text style={styles.totalLabelFinal}>{formatFcfa(d.montantTtc)}</Text>
          </View>
          {d.montantRecu != null && d.montantRecu > 0 && (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Montant reçu</Text>
                <Text style={styles.totalLabel}>{formatFcfa(d.montantRecu)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Solde</Text>
                <Text style={styles.totalLabel}>{formatFcfa(solde)}</Text>
              </View>
            </>
          )}
        </View>

        {d.infosComplementaires && (
          <Text style={styles.infosComplementaires}>
            <Text style={styles.bold}>Informations complémentaires : </Text>
            {d.infosComplementaires}
          </Text>
        )}

        <View style={styles.spacer} />

        <View style={styles.signatures}>
          <View>
            <Text style={styles.signatureLabel}>Le Client</Text>
            <View style={styles.signatureLine} />
          </View>
          <View>
            <Text style={styles.signatureLabel}>{parametres.labelSignataireDroite}</Text>
            <View style={styles.signatureLine} />
          </View>
        </View>

        {parametres.afficherMentionsLegales && <Text style={styles.legalMentions}>{MENTIONS_LEGALES_TEXTE}</Text>}
      </Page>
    </Document>
  );
}

export async function generateAffaireDocumentPdf(data: AffaireDocumentData): Promise<DocumentGenere> {
  const [qrDataUrl, parametres] = await Promise.all([
    generateQrPngDataUrl(data.qrPayload ?? suiviPayloadProvisoire(data.numero)),
    chargerParametresAffaireDocument(data.docType),
  ]);
  const buffer = await renderToBuffer(
    <AffaireDocumentDocument data={data} qrDataUrl={qrDataUrl} parametres={parametres} />
  );
  return { buffer, hashSha256: sha256Hex(buffer) };
}
