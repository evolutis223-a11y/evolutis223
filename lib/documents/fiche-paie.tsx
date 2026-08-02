// Générateur PDF de la Fiche de paie (§13 — A4, même patron que bon-livraison.tsx/recu-caisse.tsx).
// Pas de QR : contrairement au Bon de livraison, ce document n'a pas de pendant "suivi public"
// (§11) — rien à encoder. Numéro dérivé à la génération (PAIE-{période}-{personnelId}), pas
// stocké en base, même logique que "BL-{numeroAffaire}" pour le Bon de livraison.

import React from "react";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { ASSET_BUFFERS } from "./assets";
import { formatDateHeure, formatFcfa } from "./format";
import { sha256Hex } from "./hash";
import { MENTIONS_LEGALES_TEXTE } from "./legal-mentions";
import { chargerParametresFichePaie, type ParametresFichePaie } from "./parametres";
import type { DocumentGenere, FichePaieData } from "./types";

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
  logo: { width: 100, height: 29, objectFit: "contain" },
  headerCenter: { textAlign: "right" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 8.5, color: "#444", marginTop: 3 },
  infoRow: { flexDirection: "row", marginBottom: 14 },
  infoBlock: { flex: 1, fontSize: 10 },
  infoLine: { marginBottom: 3 },
  bold: { fontFamily: "Helvetica-Bold" },
  table: { marginBottom: 12 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#000" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ddd" },
  th: { color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 9, padding: 5 },
  td: { fontSize: 9.5, padding: 6 },
  colDesignation: { flex: 4 },
  colMontant: { flex: 1.6, textAlign: "right" },
  totalRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#000", marginTop: 4 },
  totalLabel: { flex: 4, fontFamily: "Helvetica-Bold", fontSize: 11, padding: 6 },
  totalMontant: { flex: 1.6, textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 11, padding: 6 },
  spacer: { flexGrow: 1 },
  signatures: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 16 },
  signatureLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-BoldOblique",
    textDecoration: "underline",
  },
  signatureLine: { marginTop: 40, borderTopWidth: 1, borderTopColor: "#000", width: 170 },
  legalMentions: {
    borderTopWidth: 1,
    borderTopColor: "#000",
    paddingTop: 5,
    fontSize: 6.6,
    color: "#333",
    textAlign: "center",
  },
});

function normaliser(data: FichePaieData) {
  return { ...data, dateEmission: data.dateEmission ?? new Date() };
}

export function FichePaieDocument({ data, parametres }: { data: FichePaieData; parametres: ParametresFichePaie }) {
  const d = normaliser(data);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={ASSET_BUFFERS.logo} style={styles.logo} />
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Fiche de paie</Text>
            <Text style={styles.subtitle}>{`N° ${d.numero} — Période ${d.periode} — Émise le ${formatDateHeure(d.dateEmission)}`}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLine}>
              <Text style={styles.bold}>Employé(e) : </Text>
              {d.employeNom}
            </Text>
            {d.employeFonction && (
              <Text style={styles.infoLine}>
                <Text style={styles.bold}>Fonction : </Text>
                {d.employeFonction}
              </Text>
            )}
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLine}>
              <Text style={styles.bold}>Type de contrat : </Text>
              {d.typeContrat}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colDesignation]}>Rubrique</Text>
            <Text style={[styles.th, styles.colMontant]}>Montant</Text>
          </View>
          {d.rubriques.map((r, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.td, styles.colDesignation]}>{r.designation}</Text>
              <Text style={[styles.td, styles.colMontant]}>{r.montant < 0 ? `- ${formatFcfa(-r.montant)}` : formatFcfa(r.montant)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Net à payer</Text>
            <Text style={styles.totalMontant}>{formatFcfa(d.netAPayer)}</Text>
          </View>
        </View>

        <View style={styles.spacer} />

        <View style={styles.signatures}>
          <View>
            <Text style={styles.signatureLabel}>{parametres.labelSignataire}</Text>
            <View style={styles.signatureLine} />
          </View>
        </View>

        {parametres.afficherMentionsLegales && <Text style={styles.legalMentions}>{MENTIONS_LEGALES_TEXTE}</Text>}
      </Page>
    </Document>
  );
}

export async function generateFichePaiePdf(data: FichePaieData): Promise<DocumentGenere> {
  const parametres = await chargerParametresFichePaie();
  const buffer = await renderToBuffer(<FichePaieDocument data={data} parametres={parametres} />);
  return { buffer, hashSha256: sha256Hex(buffer) };
}
