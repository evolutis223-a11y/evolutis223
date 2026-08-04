import type { CSSProperties, ReactNode } from "react";
import { formatFcfa } from "@/lib/format";

// Source unique de vérité pour l'aperçu "vrai document imprimable" — décision utilisateur
// 2026-08-04 : les corrections se font UNIQUEMENT ici (Paramètres > Mes modèles), les autres
// écrans (Affaires, Documents) ne font qu'utiliser ce composant avec leurs propres données.
export interface DocumentPreviewLigne {
  nom: string;
  qte: number;
  pu: number;
}

export interface DocumentPreviewData {
  type: string; // FACTURE | DEVIS | PROFORMA | BON_COMMANDE | TICKET | COMMANDE_ATTENTE | AVOIR
  numero: string;
  dateCreation: Date | string;
  immuable: boolean;
  objet: string | null;
  clientNom: string;
  clientAdresse: string | null;
  clientTelephone: string | null;
  commercialNom: string | null;
  provenance: string | null;
  modeFinalisation: string | null;
  adresseLivraison: string | null;
  tvaPct: number | null;
  remiseMontant: number | null;
  remiseUnite: string | null;
  montantTtc: number;
  montantRegle: number;
  infosComplementaires: string | null;
  mentionValidite: string | null;
  acomptePct: number | null;
  lignes: DocumentPreviewLigne[];
  // Facultatif — maquette module Règlements ("Fiche de règlement", regFoundDoc.paiementsHistoriqueDisplay) :
  // historique des règlements déjà encaissés sur ce document, affiché entre les totaux et la signature.
  historiquePaiements?: { date: Date | string; type: string; mode: string; montant: number }[];
}

const TITRE_PAR_TYPE: Record<string, string> = {
  FACTURE: "FACTURE",
  DEVIS: "DEVIS",
  PROFORMA: "PROFORMA",
  BON_COMMANDE: "BON DE COMMANDE",
  BON_LIVRAISON: "BON DE LIVRAISON",
  TICKET: "REÇU",
  COMMANDE_ATTENTE: "COMMANDE",
  AVOIR: "AVOIR",
};
// Types "réels" au sens document imprimable — signature/cachet n'a de sens que pour ceux-là.
// COMMANDE_ATTENTE = pas encore classée, AVOIR = géré à part plus tard.
const TYPES_CLASSES = ["FACTURE", "DEVIS", "PROFORMA", "BON_COMMANDE", "BON_LIVRAISON", "TICKET"];
const TYPES_AVEC_CONDITIONS = ["FACTURE", "DEVIS", "PROFORMA", "BON_COMMANDE"];

function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("fr-FR");
}

export function calculerTotauxDocument(d: Pick<DocumentPreviewData, "lignes" | "remiseMontant" | "remiseUnite" | "tvaPct" | "montantTtc">) {
  const sousTotal = d.lignes.reduce((s, l) => s + l.qte * l.pu, 0);
  const remiseValeur = !d.remiseMontant ? 0 : d.remiseUnite === "%" ? sousTotal * (d.remiseMontant / 100) : d.remiseMontant;
  const ht = Math.max(0, sousTotal - remiseValeur);
  const tva = d.tvaPct ? ht * (d.tvaPct / 100) : 0;
  return { sousTotal, remiseValeur, ht, tva, ttc: d.montantTtc };
}

const docInputRow: CSSProperties = { display: "flex", justifyContent: "space-between", padding: "2px 0" };

export function DocumentPreview({
  data,
  masthead,
  footer,
  editMode = false,
  onMastheadChange,
  onMastheadSave,
}: {
  data: DocumentPreviewData;
  masthead: string;
  footer?: ReactNode;
  editMode?: boolean;
  onMastheadChange?: (v: string) => void;
  onMastheadSave?: (v: string) => void;
}) {
  const titre = TITRE_PAR_TYPE[data.type] ?? data.type;
  const estClasse = TYPES_CLASSES.includes(data.type);
  const aConditions = TYPES_AVEC_CONDITIONS.includes(data.type);
  const { sousTotal, remiseValeur, ht, tva, ttc } = calculerTotauxDocument(data);
  const solde = Math.max(0, ttc - data.montantRegle);
  const canal = data.provenance && data.provenance !== "Boutique physique" ? "BOUTIQUE EN LIGNE" : "BOUTIQUE PHYSIQUE";

  return (
    <div style={{ background: "#fff", color: "#000", borderRadius: 6, padding: 24, fontFamily: "Arial,sans-serif", fontSize: 13, position: "relative" }}>
      {/* En-tête — toujours en haut, jamais déplacée par un statut (décision utilisateur 2026-08-04) */}
      <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0, padding: "4px 8px 4px 0", display: "flex", alignItems: "center" }}>
          <img src="/logo.png" alt="" style={{ height: 50, width: 174 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{titre}</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              N° {data.numero} — {formatDate(data.dateCreation)}
            </div>
            {estClasse && (
              <div style={{ display: "inline-block", marginTop: 4, padding: "3px 9px", border: "1px solid #000", fontSize: 10, fontWeight: 700 }}>CANAL : {canal}</div>
            )}
          </div>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent("EVOLUTIS223|" + data.numero)}`}
            alt="QR"
            style={{ width: 48, height: 48, flexShrink: 0 }}
          />
        </div>
      </div>
      {/* Statut "en attente" — étiquette discrète en rouge, ne remplace jamais le titre */}
      {!data.immuable && (
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <span style={{ color: "#b91c1c", fontWeight: 700, fontSize: 10.5, letterSpacing: "0.03em" }}>● EN ATTENTE DE VALIDATION</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1.2, minWidth: 0, padding: 10, fontSize: 13 }}>
          <b>Objet :</b> {data.objet || "—"}
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: "10px 10px 10px 46px", fontSize: 13 }}>
          <b style={{ textDecoration: "underline" }}>DOIT :</b>
          <br />
          <b>{data.clientNom}</b>
          {data.clientAdresse && (
            <>
              <br />
              <span style={{ fontSize: 11.5, color: "#555" }}>{data.clientAdresse}</span>
            </>
          )}
          {data.clientTelephone && (
            <>
              <br />
              <span style={{ fontSize: 11.5, color: "#555" }}>Tel {data.clientTelephone}</span>
            </>
          )}
          {data.commercialNom && (
            <>
              <br />
              <span style={{ fontSize: 11.5, color: "#555" }}>Commercial : {data.commercialNom}</span>
            </>
          )}
        </div>
      </div>

      {data.modeFinalisation === "LIVRAISON" && (
        <div style={{ padding: "0 10px 10px", fontSize: 12 }}>
          🚚 <b>Livraison :</b> {data.adresseLivraison || "—"}
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 10 }}>
        <thead>
          <tr style={{ background: "#000", color: "#fff" }}>
            <th style={{ padding: 6, border: "1px solid #000", textAlign: "left" }}>N°</th>
            <th style={{ padding: 6, border: "1px solid #000", textAlign: "left" }}>Désignation</th>
            <th style={{ padding: 6, border: "1px solid #000" }}>Qté</th>
            <th style={{ padding: 6, border: "1px solid #000" }}>P.U.</th>
            <th style={{ padding: 6, border: "1px solid #000" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {data.lignes.map((l, i) => (
            <tr key={i}>
              <td style={{ padding: 8, border: "1px solid #000" }}>{i + 1}</td>
              <td style={{ padding: 8, border: "1px solid #000" }}>{l.nom}</td>
              <td style={{ padding: 8, border: "1px solid #000", textAlign: "center" }}>{l.qte}</td>
              <td style={{ padding: 8, border: "1px solid #000", textAlign: "right" }}>{formatFcfa(l.pu)}</td>
              <td style={{ padding: 8, border: "1px solid #000", textAlign: "right" }}>{formatFcfa(l.qte * l.pu)}</td>
            </tr>
          ))}
          {data.lignes.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: 12, border: "1px solid #000", textAlign: "center", color: "#888" }}>
                Aucune ligne.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        {aConditions && (
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ background: "#000", color: "#fff", fontWeight: 700, padding: "5px 8px" }}>Conditions de paiement</div>
            <div style={{ padding: 8, fontSize: 12, border: "1px solid #000", borderTop: "none" }}>
              <div>
                <b>Validité :</b> {data.mentionValidite || "Valable 30 jours"}
              </div>
              <div style={{ marginTop: 4 }}>
                <b>Informations complémentaires :</b> {data.infosComplementaires || "—"}
              </div>
              {data.acomptePct != null && (
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Acompte à la commande</span>
                    <span>{data.acomptePct}%</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Solde à la livraison</span>
                    <span>{100 - data.acomptePct}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, fontSize: 13, border: "1px solid #000" }}>
          <div style={docInputRow}>
            <span>SOUS-TOTAL</span>
            <span>{formatFcfa(sousTotal)}</span>
          </div>
          <div style={{ ...docInputRow, padding: "2px 8px" }}>
            <span>REMISE</span>
            <span>{remiseValeur > 0 ? `-${formatFcfa(remiseValeur)}` : "—"}</span>
          </div>
          <div style={{ ...docInputRow, padding: "5px 8px" }}>
            <span>TOTAL HT</span>
            <span>{formatFcfa(ht)}</span>
          </div>
          <div style={{ ...docInputRow, padding: "5px 8px" }}>
            <span>TVA ({data.tvaPct ?? 0}%)</span>
            <span>{formatFcfa(tva)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", borderTop: "2px solid #000", fontWeight: 800, fontSize: 15 }}>
            <span>TOTAL TTC</span>
            <span>{formatFcfa(ttc)}</span>
          </div>
          {data.montantRegle > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px", color: "#166534", borderTop: "1px solid #000" }}>
              <span>Réglé</span>
              <span>{formatFcfa(data.montantRegle)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px", color: "#b91c1c", fontWeight: 700, borderTop: "1px solid #000" }}>
            <span>SOLDE</span>
            <span>{formatFcfa(solde)}</span>
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 12, fontStyle: "italic", color: "#333", margin: "6px 0 10px" }}>Merci pour votre confiance.</div>

      {!!data.historiquePaiements?.length && (
        <div style={{ marginBottom: 10, paddingTop: 10, borderTop: "1px solid #000" }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
            Historique des paiements — {titre} N° {data.numero}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#000", color: "#fff" }}>
                <th style={{ padding: 5, border: "1px solid #000", textAlign: "left" }}>Date</th>
                <th style={{ padding: 5, border: "1px solid #000", textAlign: "left" }}>Type</th>
                <th style={{ padding: 5, border: "1px solid #000", textAlign: "left" }}>Mode</th>
                <th style={{ padding: 5, border: "1px solid #000", textAlign: "right" }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {data.historiquePaiements.map((p, i) => (
                <tr key={i}>
                  <td style={{ padding: 5, border: "1px solid #000" }}>{formatDate(p.date)}</td>
                  <td style={{ padding: 5, border: "1px solid #000" }}>{p.type}</td>
                  <td style={{ padding: 5, border: "1px solid #000" }}>{p.mode}</td>
                  <td style={{ padding: 5, border: "1px solid #000", textAlign: "right" }}>{formatFcfa(p.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {estClasse && (
        <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <span style={{ fontStyle: "italic", fontSize: 15, fontWeight: 700, textDecoration: "underline" }}>Le Client</span>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontStyle: "italic", fontSize: 15, fontWeight: 700, textDecoration: "underline" }}>Pour EVOLUTIS223</div>
            <div style={{ position: "relative", width: 90, marginLeft: "auto", marginTop: 2 }}>
              <img src="/cachet.png" alt="" style={{ height: 88, width: 90, display: "block" }} />
              <img src="/signature.png" alt="" style={{ height: 150, position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }} />
            </div>
          </div>
        </div>
      )}

      <div style={{ borderTop: "1px solid #000", paddingTop: 8 }}>
        {editMode ? (
          <textarea
            value={masthead}
            onChange={(e) => onMastheadChange?.(e.target.value)}
            onBlur={(e) => onMastheadSave?.(e.target.value)}
            style={{ width: "100%", height: 44, background: "#fff", border: "1px solid #999", color: "#333", fontFamily: "Arial,sans-serif", fontSize: 9, padding: 6, boxSizing: "border-box", textAlign: "center" }}
          />
        ) : (
          <div style={{ textAlign: "center", fontSize: 9.5, color: "#333", whiteSpace: "pre-line" }}>{masthead}</div>
        )}
      </div>
      {footer}
    </div>
  );
}
