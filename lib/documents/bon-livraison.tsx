// Générateur PDF du Bon de livraison (§13 — A4, deuxième modèle, même patron que recu-caisse.tsx).
// Mise en page basée sur design/Modele Bon Livraison.dc.html (structure/contenu réutilisés,
// pas le DOM littéral). Écart assumé par rapport au mockup : le libellé de la signature de
// droite ("Le Fournisseur" dans le fichier source) est un artefact de copier-coller depuis
// Modele Bon Commande.dc.html — EVOLUTIS223 est le livreur ici, pas un fournisseur ; corrigé
// en "EVOLUTIS223", rendu paramétrable (§13 option 1) au cas où l'utilisateur préfère un autre
// libellé une fois qu'il verra le rendu.

import React from "react";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { ASSET_BUFFERS } from "./assets";
import { formatDateHeure } from "./format";
import { sha256Hex } from "./hash";
import { MENTIONS_LEGALES_TEXTE } from "./legal-mentions";
import { chargerParametresBonLivraison, type ParametresBonLivraison } from "./parametres";
import { generateQrPngDataUrl, suiviPayloadProvisoire } from "./qr";
import type { BonLivraisonData, DocumentGenere } from "./types";

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
  headerRight: { flexDirection: "row", alignItems: "center" },
  headerCenter: { textAlign: "center", marginRight: 14 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 8.5, color: "#444", marginTop: 3 },
  canalBadge: {
    marginTop: 4,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#000",
    paddingVertical: 2,
    paddingHorizontal: 8,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
  },
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
  colNum: { flex: 0.5, textAlign: "center" },
  colDesignation: { flex: 4 },
  colQte: { flex: 1.4, textAlign: "center" },
  remarques: { fontSize: 10, marginBottom: 20 },
  spacer: { flexGrow: 1 },
  signatures: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
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

function normaliser(data: BonLivraisonData) {
  return { ...data, dateEmission: data.dateEmission ?? new Date() };
}

export function BonLivraisonDocument({
  data,
  qrDataUrl,
  parametres,
}: {
  data: BonLivraisonData;
  qrDataUrl: string;
  parametres: ParametresBonLivraison;
}) {
  const d = normaliser(data);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={ASSET_BUFFERS.logo} style={styles.logo} />
          <View style={styles.headerRight}>
            <View style={styles.headerCenter}>
              <Text style={styles.title}>Bon de livraison</Text>
              <Text style={styles.subtitle}>{`N° ${d.numero} — ${formatDateHeure(d.dateEmission)}`}</Text>
              <Text style={styles.canalBadge}>{d.canal.toUpperCase()}</Text>
            </View>
            <Image src={qrDataUrl} style={styles.qr} />
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLine}>
              <Text style={styles.bold}>Objet : </Text>
              {d.objet}
            </Text>
            <Text style={styles.infoLine}>
              <Text style={styles.bold}>Affaire liée : </Text>
              {d.affaireNumero}
            </Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLine}>
              <Text style={styles.bold}>Client : </Text>
              {d.clientNom}
            </Text>
            {d.clientContact && <Text style={styles.infoLine}>Contact : {d.clientContact}</Text>}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colNum]}>N°</Text>
            <Text style={[styles.th, styles.colDesignation]}>Désignation</Text>
            <Text style={[styles.th, styles.colQte]}>Qté commandée</Text>
            <Text style={[styles.th, styles.colQte]}>Qté livrée</Text>
          </View>
          {d.lignes.map((ligne, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.td, styles.colNum]}>{i + 1}</Text>
              <Text style={[styles.td, styles.colDesignation]}>{ligne.designation}</Text>
              <Text style={[styles.td, styles.colQte]}>{ligne.quantiteCommandee}</Text>
              <Text style={[styles.td, styles.colQte]}>{ligne.quantiteLivree}</Text>
            </View>
          ))}
        </View>

        {d.remarques && (
          <Text style={styles.remarques}>
            <Text style={styles.bold}>Remarques : </Text>
            {d.remarques}
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

export async function generateBonLivraisonPdf(data: BonLivraisonData): Promise<DocumentGenere> {
  const [qrDataUrl, parametres] = await Promise.all([
    generateQrPngDataUrl(data.qrPayload ?? suiviPayloadProvisoire(data.affaireNumero)),
    chargerParametresBonLivraison(),
  ]);
  const buffer = await renderToBuffer(
    <BonLivraisonDocument data={data} qrDataUrl={qrDataUrl} parametres={parametres} />
  );
  return { buffer, hashSha256: sha256Hex(buffer) };
}
