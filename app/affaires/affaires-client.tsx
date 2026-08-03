"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, type ShellModule } from "@/components/app-shell";
import type { affaires, articles, demandesValidationStock, lignesAffaire, reglements } from "@/db/schema";
import {
  ajouterReglement,
  creerAffaireDepuisFormulaire,
  validerAffaire,
  type DetailsAffaireInput,
  type LigneInput,
  type ReglementState,
} from "./actions";

type Article = typeof articles.$inferSelect;
type Variante = {
  id: number;
  articleId: number;
  taille: string | null;
  couleur: string | null;
  stockDetail?: number | null;
};
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

const TRASH_RED_FILTER = "brightness(0) saturate(100%) invert(13%) sepia(94%) saturate(7471%) hue-rotate(2deg) brightness(96%) contrast(119%)";

function articleHorsStock(article: Article, variantesList: Variante[]): boolean {
  if (article.famille !== "A") return false;
  const variantesArticle = variantesList.filter((v) => v.articleId === article.id);
  if (variantesArticle.length === 0) return false;
  return variantesArticle.every((v) => (v.stockDetail ?? 0) <= 0);
}

export function LigneEditorRow({
  articlesList,
  variantesList,
  ligne,
  canSeePrixAchat = false,
  onChange,
  onRemove,
}: {
  articlesList: Article[];
  variantesList: Variante[];
  ligne: LigneInput;
  canSeePrixAchat?: boolean;
  onChange: (l: LigneInput) => void;
  onRemove: () => void;
}) {
  const article = articlesList.find((a) => a.id === ligne.articleId);
  const variantesArticle = variantesList.filter((v) => v.articleId === ligne.articleId);
  const [query, setQuery] = useState(article?.nom ?? "");
  const [focused, setFocused] = useState(false);

  const suggestions =
    focused && query.trim() && (!article || article.nom !== query)
      ? articlesList.filter((a) => a.nom.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
      : [];

  function pick(a: Article) {
    const varianteParDefaut = a.famille !== "A" ? variantesList.find((v) => v.articleId === a.id) : null;
    onChange({ ...ligne, articleId: a.id, varianteId: varianteParDefaut?.id ?? null, prixUnitaire: Number(a.prixVente) });
    setQuery(a.nom);
    setFocused(false);
  }

  const isHorsStock = article ? articleHorsStock(article, variantesList) : false;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8, alignItems: "center" }}>
      <div style={{ position: "relative", flex: 1.5, minWidth: 140 }}>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (article) onChange({ ...ligne, articleId: 0, varianteId: null, prixUnitaire: 0 });
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder="Saisir le nom de l'article…"
          spellCheck
          lang="fr"
          style={inputStyle}
        />
        {suggestions.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, marginTop: 4, maxHeight: 220, overflowY: "auto", zIndex: 30, boxShadow: "0 8px 20px rgba(0,0,0,0.4)" }}>
            {suggestions.map((a) => {
              const horsStock = articleHorsStock(a, variantesList);
              return (
                <div key={a.id} style={{ padding: "9px 12px", borderBottom: "1px solid #262626" }}>
                  <div onMouseDown={() => pick(a)} style={{ cursor: "pointer", fontSize: 13.5, color: horsStock ? "#888" : "#e0e0e0" }}>
                    {a.nom}
                    {horsStock && " — rupture"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {article?.famille === "A" && (
        <select style={{ ...inputStyle, flex: 1, minWidth: 130 }} value={ligne.varianteId ?? ""} onChange={(e) => onChange({ ...ligne, varianteId: Number(e.target.value) })}>
          <option value="">Taille/couleur...</option>
          {variantesArticle.map((v) => (
            <option key={v.id} value={v.id}>
              {v.taille} {v.couleur}
            </option>
          ))}
        </select>
      )}

      {isHorsStock && (
        <span title="Article hors stock — cas exceptionnel, tracé pour le rapport" style={{ background: "#f59e0b", color: "#000", fontSize: 10, fontWeight: 700, padding: "3px 6px", borderRadius: 5, flexShrink: 0, whiteSpace: "nowrap" }}>
          HORS STOCK
        </span>
      )}

      <input
        type="number"
        min="1"
        value={ligne.quantite}
        onChange={(e) => onChange({ ...ligne, quantite: Number(e.target.value) })}
        placeholder="Qté"
        style={{ ...inputStyle, width: 60, textAlign: "center" }}
      />
      {canSeePrixAchat && (
        <input
          type="number"
          min="0"
          value={article ? Number(article.pmp) : ""}
          readOnly
          title="Prix d'achat"
          placeholder="Auto (stock)"
          style={{ ...inputStyle, width: 95, background: "#0c0c0c", color: "#888" }}
        />
      )}
      <input
        type="number"
        min="0"
        value={ligne.prixUnitaire}
        onChange={(e) => onChange({ ...ligne, prixUnitaire: Number(e.target.value) })}
        placeholder="Prix de vente"
        title="Prix de vente"
        style={{ ...inputStyle, width: 110 }}
      />
      <button
        onClick={onRemove}
        aria-label="Retirer"
        style={{ background: "none", border: "1px solid #333", borderRadius: 8, width: 36, height: 36, flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <span style={{ fontSize: 18, filter: TRASH_RED_FILTER }}>🗑️</span>
      </button>

      {article?.famille === "D" && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#888", width: "100%" }}>
          <input type="checkbox" checked={ligne.personnalise ?? true} onChange={(e) => onChange({ ...ligne, personnalise: e.target.checked })} />
          Nouveau visuel/design à concevoir (décocher si modèle déjà validé — l&apos;OF ira directement en Production)
        </label>
      )}
    </div>
  );
}

const PROVENANCES = ["Boutique physique", "Boutique en ligne", "WhatsApp", "TikTok", "Facebook"];

const DOCTYPE_OPTIONS_PAR_ROLE: Record<string, { value: "DEVIS" | "FACTURE" | "PROFORMA" | "TICKET"; label: string }[]> = {
  SUPER_ADMIN: [
    { value: "DEVIS", label: "Devis" },
    { value: "FACTURE", label: "Facture" },
    { value: "PROFORMA", label: "Proforma" },
    { value: "TICKET", label: "Reçu" },
  ],
  ADMIN: [
    { value: "DEVIS", label: "Devis" },
    { value: "FACTURE", label: "Facture" },
    { value: "PROFORMA", label: "Proforma" },
    { value: "TICKET", label: "Reçu" },
  ],
  FREELANCE: [{ value: "PROFORMA", label: "Proforma" }],
};
const DOCTYPE_OPTIONS_DEFAUT: { value: "DEVIS" | "FACTURE" | "PROFORMA" | "TICKET"; label: string }[] = [
  { value: "FACTURE", label: "Facture" },
  { value: "PROFORMA", label: "Proforma" },
  { value: "TICKET", label: "Reçu" },
];
const DOCTYPE_LABEL: Record<string, string> = { DEVIS: "Devis", FACTURE: "Facture", PROFORMA: "Proforma", TICKET: "Reçu" };

function NouvelleAffairePage({
  articlesList,
  variantesList,
  roleCode,
  onClose,
}: {
  articlesList: Article[];
  variantesList: Variante[];
  roleCode: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const docTypeOptions = DOCTYPE_OPTIONS_PAR_ROLE[roleCode] ?? DOCTYPE_OPTIONS_DEFAUT;
  const [provenance, setProvenance] = useState("");
  const [docType, setDocType] = useState<"DEVIS" | "FACTURE" | "PROFORMA" | "TICKET">(docTypeOptions[0].value);
  const [nomClient, setNomClient] = useState("");
  const [telephoneClient, setTelephoneClient] = useState("");
  const [emailClient, setEmailClient] = useState("");
  const [adresseClient, setAdresseClient] = useState("");
  const [objet, setObjet] = useState("");
  const [tva, setTva] = useState("");
  const [remise, setRemise] = useState("");
  const [remiseUnite, setRemiseUnite] = useState<"%" | "F">("%");
  const [lignes, setLignes] = useState<LigneInput[]>([{ articleId: 0, varianteId: null, quantite: 1, prixUnitaire: 0 }]);
  const [modeFinalisation, setModeFinalisation] = useState<"" | "RETRAIT" | "LIVRAISON">("");
  const [adresseLivraison, setAdresseLivraison] = useState("");
  const [delaiNombre, setDelaiNombre] = useState("");
  const [delaiUnite, setDelaiUnite] = useState("Jour");
  const [dateLivraison, setDateLivraison] = useState("");
  const [infosComplementaires, setInfosComplementaires] = useState("");
  const [montantRecu, setMontantRecu] = useState("");
  const [modeReglement, setModeReglement] = useState("ESPECES");
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [pending, setPending] = useState(false);
  const [draftMsg, setDraftMsg] = useState<string | null>(null);

  const DRAFT_KEY = "evolutis223_brouillon_affaire";

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      setProvenance(d.provenance ?? "");
      setDocType(d.docType ?? docTypeOptions[0].value);
      setNomClient(d.nomClient ?? "");
      setTelephoneClient(d.telephoneClient ?? "");
      setEmailClient(d.emailClient ?? "");
      setAdresseClient(d.adresseClient ?? "");
      setObjet(d.objet ?? "");
      setTva(d.tva ?? "");
      setRemise(d.remise ?? "");
      setRemiseUnite(d.remiseUnite ?? "%");
      setLignes(d.lignes ?? [{ articleId: 0, varianteId: null, quantite: 1, prixUnitaire: 0 }]);
      setModeFinalisation(d.modeFinalisation ?? "");
      setAdresseLivraison(d.adresseLivraison ?? "");
      setInfosComplementaires(d.infosComplementaires ?? "");
      setDraftMsg("Brouillon restauré.");
    } catch {
      // brouillon corrompu — ignoré silencieusement, pas bloquant pour l'écran.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sauvegarderBrouillon() {
    const d = {
      provenance, docType, nomClient, telephoneClient, emailClient, adresseClient, objet, tva, remise, remiseUnite,
      lignes, modeFinalisation, adresseLivraison, infosComplementaires,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    setDraftMsg(`Brouillon enregistré — ${new Date().toLocaleTimeString("fr-FR")}`);
  }

  const brut = lignes.reduce((acc, l) => acc + l.quantite * l.prixUnitaire, 0);
  const remiseValeur = remiseUnite === "%" ? brut * ((Number(remise) || 0) / 100) : Number(remise) || 0;
  // Même formule que creerAffaireInterne (actions.ts) : la TVA est capturée pour le document
  // mais n'est PAS ajoutée au total — montantTtc = brut - remise uniquement. Ligne d'info séparée
  // ci-dessous, pas incluse dans le calcul, pour ne pas afficher un aperçu qui ment sur le vrai total.
  const total = Math.max(0, brut - remiseValeur);
  const tvaValeur = total * ((Number(tva) || 0) / 100);
  const solde = total - (Number(montantRecu) || 0);

  const lignesApercu = lignes
    .filter((l) => l.articleId)
    .map((l) => {
      const art = articlesList.find((a) => a.id === l.articleId);
      const vnt = variantesList.find((v) => v.id === l.varianteId);
      return {
        designation: [art?.nom, vnt?.taille, vnt?.couleur].filter(Boolean).join(" — ") || "Article",
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        total: l.quantite * l.prixUnitaire,
      };
    });

  function reinitialiser() {
    setProvenance("");
    setNomClient("");
    setTelephoneClient("");
    setEmailClient("");
    setAdresseClient("");
    setObjet("");
    setTva("");
    setRemise("");
    setLignes([{ articleId: 0, varianteId: null, quantite: 1, prixUnitaire: 0 }]);
    setFormKey((k) => k + 1);
    setModeFinalisation("");
    setAdresseLivraison("");
    setDelaiNombre("");
    setDelaiUnite("Jour");
    setDateLivraison("");
    setInfosComplementaires("");
    setMontantRecu("");
    setError(null);
    setDraftMsg(null);
    localStorage.removeItem(DRAFT_KEY);
  }

  async function submit() {
    setError(null);
    if (!nomClient.trim() || !telephoneClient.trim()) return setError("Nom et téléphone du client requis.");
    const valid = lignes.filter((l) => l.articleId);
    if (valid.length === 0) return setError("Au moins une ligne requise.");
    if (modeFinalisation === "LIVRAISON" && !adresseLivraison.trim()) return setError("Adresse de livraison requise.");

    setPending(true);
    const details: DetailsAffaireInput = {
      provenance: provenance || null,
      objet: objet.trim() || null,
      tvaPct: tva ? Number(tva) : null,
      remiseMontant: remise ? Number(remise) : null,
      remiseUnite: remise ? remiseUnite : null,
      infosComplementaires: infosComplementaires.trim() || null,
      docType,
    };
    const res = await creerAffaireDepuisFormulaire(
      nomClient.trim(),
      telephoneClient.trim(),
      emailClient.trim() || null,
      adresseClient.trim() || null,
      valid,
      modeFinalisation || null,
      modeFinalisation === "LIVRAISON" ? adresseLivraison.trim() : null,
      details
    );
    if (res.error || !res.affaireId) {
      setPending(false);
      return setError(res.error ?? "Erreur inconnue.");
    }
    if (Number(montantRecu) > 0) {
      const fd = new FormData();
      fd.set("affaireId", String(res.affaireId));
      fd.set("montant", montantRecu);
      fd.set("mode", modeReglement);
      await ajouterReglement({ error: null }, fd);
    }
    localStorage.removeItem(DRAFT_KEY);
    setPending(false);
    router.refresh();
    onClose();
  }

  return (
    <div style={{ padding: 20, display: "flex", gap: 20 }}>
      <div style={{ flex: 1, minWidth: 0, background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>+ Nouvelle affaire</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={reinitialiser} style={{ background: "none", border: "1px solid #333", color: "#888", fontSize: 11, padding: "4px 9px", borderRadius: 5, cursor: "pointer" }}>
              ↺ Réinitialiser
            </button>
            <button onClick={onClose} style={{ background: "none", border: "1px solid #333", color: "#888", fontSize: 11, padding: "4px 9px", borderRadius: 5, cursor: "pointer" }}>
              ← Retour à la liste
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
          <select value={provenance} onChange={(e) => setProvenance(e.target.value)} style={{ ...inputStyle, flex: 0.7 }}>
            <option value="">Provenance…</option>
            {PROVENANCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select value={docType} onChange={(e) => setDocType(e.target.value as typeof docType)} style={{ ...inputStyle, flex: 0.7 }}>
            {docTypeOptions.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <input value={nomClient} onChange={(e) => setNomClient(e.target.value)} placeholder="Nom du client" style={{ ...inputStyle, flex: 1.6 }} />
        </div>

        {!provenance && <div style={{ fontSize: 12.5, color: "#f59e0b", marginBottom: 10 }}>⚠️ Sélectionnez d&apos;abord la provenance pour continuer.</div>}

        <div style={{ opacity: provenance ? 1 : 0.4, pointerEvents: provenance ? "auto" : "none", transition: "opacity .15s" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 12 }}>
            <input value={telephoneClient} onChange={(e) => setTelephoneClient(e.target.value)} placeholder="Téléphone" style={inputStyle} />
            <input value={emailClient} onChange={(e) => setEmailClient(e.target.value)} placeholder="Email" style={inputStyle} />
            <input value={adresseClient} onChange={(e) => setAdresseClient(e.target.value)} placeholder="Adresse" style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 130px", gap: 16, marginBottom: 12 }}>
            <input value={objet} onChange={(e) => setObjet(e.target.value)} placeholder="Objet" style={inputStyle} />
            <input value={tva} onChange={(e) => setTva(e.target.value)} placeholder="TVA %" type="number" style={inputStyle} />
            <div style={{ display: "flex" }}>
              <input
                value={remise}
                onChange={(e) => setRemise(e.target.value)}
                placeholder="Remise"
                type="number"
                style={{ ...inputStyle, borderRight: "none", borderRadius: "8px 0 0 8px" }}
              />
              <select
                value={remiseUnite}
                onChange={(e) => setRemiseUnite(e.target.value as "%" | "F")}
                style={{ width: 50, flexShrink: 0, background: "#333", color: "#e0e0e0", border: "none", borderRadius: "0 8px 8px 0", fontSize: 13, textAlign: "center" }}
              >
                <option value="%">%</option>
                <option value="F">F</option>
              </select>
            </div>
          </div>

          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginTop: 16, marginBottom: 8 }}>Articles</div>
          <div>
            {lignes.map((l, i) => (
              <LigneEditorRow
                key={`${formKey}-${i}`}
                articlesList={articlesList}
                variantesList={variantesList}
                ligne={l}
                canSeePrixAchat={roleCode === "SUPER_ADMIN" || roleCode === "ADMIN"}
                onChange={(nl) => {
                  setLignes((arr) => {
                    const next = arr.map((x, j) => (j === i ? nl : x));
                    // La dernière ligne se transforme automatiquement en ligne vide dès qu'un
                    // article y est choisi — pas de bouton "+ Article" (n'existe pas sur la maquette).
                    if (i === arr.length - 1 && nl.articleId) {
                      next.push({ articleId: 0, varianteId: null, quantite: 1, prixUnitaire: 0 });
                    }
                    return next;
                  });
                }}
                onRemove={() => setLignes((arr) => (arr.length > 1 ? arr.filter((_, j) => j !== i) : arr))}
              />
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
            <select value={modeFinalisation} onChange={(e) => setModeFinalisation(e.target.value as "" | "RETRAIT" | "LIVRAISON")} style={{ ...inputStyle, flex: 1, minWidth: 160 }}>
              <option value="">Retrait en boutique</option>
              <option value="RETRAIT">Retrait en boutique (préparation avant remise)</option>
              <option value="LIVRAISON">À livrer</option>
            </select>
            <span title="Délai de livraison" style={{ fontSize: 28, filter: "grayscale(1)", opacity: 0.6 }}>🚚</span>
            <input value={delaiNombre} onChange={(e) => setDelaiNombre(e.target.value)} placeholder="Nombre" style={{ ...inputStyle, width: 64, flexShrink: 0, textAlign: "center" }} />
            <select value={delaiUnite} onChange={(e) => setDelaiUnite(e.target.value)} style={{ ...inputStyle, width: 110, flexShrink: 0 }}>
              <option value="Jour">Jour(s)</option>
              <option value="Semaine">Semaine(s)</option>
              <option value="Mois">Mois</option>
              <option value="Année">Année(s)</option>
            </select>
            <div style={{ position: "relative", width: 36, height: 36, flexShrink: 0, background: "#121212", border: "1px solid #333", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 16, pointerEvents: "none" }}>📅</span>
              <input
                type="date"
                value={dateLivraison}
                onChange={(e) => setDateLivraison(e.target.value)}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", boxSizing: "border-box" }}
              />
            </div>
            {dateLivraison && <span style={{ fontSize: 13, color: "#ccc", whiteSpace: "nowrap" }}>{new Date(dateLivraison).toLocaleDateString("fr-FR")}</span>}
          </div>
          {modeFinalisation === "LIVRAISON" && (
            <div style={{ marginTop: 16, padding: 16, background: "#121212", borderRadius: 8 }}>
              <input value={adresseLivraison} onChange={(e) => setAdresseLivraison(e.target.value)} placeholder="Adresse de livraison" style={inputStyle} />
            </div>
          )}

          <div style={{ marginTop: 16, marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 4, fontSize: 11, color: "#666" }}>Informations complémentaires</label>
            <textarea
              value={infosComplementaires}
              onChange={(e) => setInfosComplementaires(e.target.value)}
              placeholder="Précisions à faire apparaître sur le document (optionnel)…"
              style={{ ...inputStyle, height: 80, resize: "vertical", fontFamily: "inherit" }}
            />
          </div>

          <div style={{ marginTop: 16, padding: 16, background: "#121212", borderRadius: 8, border: "2px solid #fff" }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <input value={montantRecu} onChange={(e) => setMontantRecu(e.target.value)} placeholder="Montant reçu" type="number" style={{ ...inputStyle, flex: 1, background: "#1e1e1e" }} />
              <select value={modeReglement} onChange={(e) => setModeReglement(e.target.value)} style={{ ...inputStyle, flex: 1, background: "#1e1e1e" }}>
                <option value="ESPECES">Espèces</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="VIREMENT">Virement</option>
                <option value="CARTE">Carte</option>
              </select>
              <div
                style={{
                  flex: 1,
                  background: "#1e1e1e",
                  border: "1px solid #333",
                  color: Number(montantRecu) <= 0 ? "#666" : solde > 0 ? "#f59e0b" : "#10b981",
                  padding: "12px 14px",
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: Number(montantRecu) <= 0 ? 400 : 700,
                  textAlign: "center",
                  fontStyle: Number(montantRecu) <= 0 ? "italic" : "normal",
                }}
              >
                {Number(montantRecu) <= 0 ? "Reliquat / Reste" : solde > 0 ? `Solde ${formatFcfa(solde)}` : "Soldé"}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, textAlign: "right", fontSize: 17, fontWeight: 700, color: "#fff" }}>Total : {formatFcfa(total)}</div>

        {error && (
          <p style={{ marginTop: 10, fontSize: 13, color: "#f87171" }} role="alert">
            {error}
          </p>
        )}
        {draftMsg && (
          <p style={{ marginTop: 10, fontSize: 12.5, color: "#34d399" }}>{draftMsg}</p>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
          <button type="button" disabled={pending || !provenance} onClick={submit} style={{ flex: 1, minWidth: 0, background: "#10b981", color: "#fff", border: "none", padding: "11px 8px", borderRadius: 6, fontSize: 15, cursor: "pointer" }}>
            {pending ? "..." : "💾 Enregistrer"}
          </button>
          <button type="button" onClick={sauvegarderBrouillon} style={{ flex: 1, minWidth: 0, background: "#3b3b3b", color: "#fff", border: "none", padding: "11px 8px", borderRadius: 6, fontSize: 15, cursor: "pointer" }}>
            📝 Brouillon
          </button>
          <button type="button" onClick={onClose} style={{ flex: 1, minWidth: 0, background: "none", color: "#dc2626", border: "1px solid #dc2626", padding: "11px 8px", borderRadius: 6, fontSize: 15, cursor: "pointer" }}>
            ✕ Annuler
          </button>
        </div>
      </div>

      {/* Aperçu instantané — même thème sombre que le reste de l'appli (forme basique, avant
          mise en page imprimable — voir design/Application de Gestion EVOLUTIS223.dc.html, bloc
          "Aperçu" de l'écran isNouveau). */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ flex: 1, background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: 24, position: "sticky", top: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>Aperçu</div>
            <button onClick={() => window.print()} style={{ background: "none", border: "none", color: "#888", fontSize: 18, cursor: "pointer" }}>
              🖨️
            </button>
          </div>

          <div style={{ fontSize: 16, color: "#fff" }}>
            <b>{DOCTYPE_LABEL[docType]}</b> - {nomClient || "Client"}
          </div>
          {objet && <div style={{ color: "#888", fontSize: 14, marginTop: 2 }}>Objet : {objet}</div>}

          <div style={{ borderTop: "1px solid #333", margin: "10px 0" }} />

          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 50px 100px 110px", gap: 8, fontSize: 13, color: "#888", textTransform: "uppercase", paddingBottom: 6, fontWeight: 700 }}>
            <span>Article</span>
            <span style={{ textAlign: "center" }}>Qté</span>
            <span style={{ textAlign: "center" }}>Montant</span>
            <span style={{ textAlign: "center" }}>Total</span>
          </div>
          <div style={{ borderTop: "1px solid #333" }}>
            {lignesApercu.length === 0 ? (
              <div style={{ padding: "10px 0", color: "#666", fontSize: 13 }}>Ajoutez des articles pour voir l&apos;aperçu.</div>
            ) : (
              lignesApercu.map((l, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1.6fr 50px 100px 110px", gap: 8, fontSize: 14, padding: "8px 0", borderBottom: "1px solid #262626", alignItems: "center" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#e0e0e0" }}>{l.designation}</span>
                  <span style={{ textAlign: "center", color: "#e0e0e0" }}>{l.quantite}</span>
                  <span style={{ textAlign: "center", color: "#e0e0e0" }}>{formatFcfa(l.prixUnitaire)}</span>
                  <span style={{ textAlign: "center", whiteSpace: "nowrap", color: "#e0e0e0" }}>{formatFcfa(l.total)}</span>
                </div>
              ))
            )}
          </div>

          <div style={{ borderTop: "2px solid #3a3a3a", marginTop: 6 }} />
          <div style={{ fontSize: 22, fontWeight: 700, color: "#3b82f6", marginTop: 10 }}>
            Total HT : {formatFcfa(brut)}
            <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 4 }}>FCFA</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", margin: "6px 0", fontSize: 15, color: "#ccc" }}>
            <span>TVA ({tva || 0}%) : {tvaValeur > 0 ? formatFcfa(tvaValeur) : "—"}</span>
            <span>Remise : {remiseValeur > 0 ? formatFcfa(remiseValeur) : "—"}</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#10b981", marginTop: 6 }}>
            Total TTC : {formatFcfa(total)}
            <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 4 }}>FCFA</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, flexWrap: "wrap", gap: "6px 12px" }}>
            <span style={{ fontSize: 15, color: "#ccc", whiteSpace: "nowrap" }}>
              <b style={{ fontWeight: 700, color: "#e0e0e0" }}>Montant reçu : {Number(montantRecu) > 0 ? formatFcfa(Number(montantRecu)) : "—"}</b>
            </span>
            {Number(montantRecu) > 0 && (
              <span style={{ fontSize: 15, fontWeight: 700, color: solde > 0 ? "#f59e0b" : "#10b981", whiteSpace: "nowrap" }}>
                {solde > 0 ? "Solde" : "Soldé"} : {formatFcfa(Math.max(0, solde))}
              </span>
            )}
          </div>

          {(provenance || modeFinalisation || adresseLivraison || infosComplementaires) && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #333", fontSize: 13, color: "#ccc" }}>
              {provenance && (
                <div style={{ marginBottom: 4 }}>
                  📍 Provenance : <b style={{ color: "#e0e0e0" }}>{provenance}</b>
                </div>
              )}
              {modeFinalisation && (
                <div style={{ marginBottom: 4 }}>🚚 {modeFinalisation === "LIVRAISON" ? "À livrer" : "Retrait en boutique"}</div>
              )}
              {modeFinalisation === "LIVRAISON" && adresseLivraison && (
                <div style={{ marginBottom: 4 }}>🏠 Adresse : {adresseLivraison}</div>
              )}
              {infosComplementaires && <div>📝 {infosComplementaires}</div>}
            </div>
          )}
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
  roleCode,
  modules,
  articles,
  variantes,
  affaires,
  lignes,
  reglements,
  demandesEnAttente,
}: {
  userName: string;
  roleLibelle: string;
  roleCode: string;
  modules: ShellModule[];
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

  if (drawerOpen) {
    return (
      <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Nouvelle affaire" modules={modules}>
        <NouvelleAffairePage
          articlesList={articles}
          variantesList={variantes}
          roleCode={roleCode}
          onClose={() => setDrawerOpen(false)}
        />
      </AppShell>
    );
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
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      {["FACTURE", "DEVIS", "PROFORMA", "BON_COMMANDE"].includes(selected.type) && (
                        <a
                          href={`/api/documents/affaire/${selected.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ ...darkButton("#333"), textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                        >
                          🖨️ Imprimer
                        </a>
                      )}
                      {!selected.immuable && !bloquee && (
                        <button disabled={validating} onClick={() => handleValider(selected.id)} style={darkButton("#dc2626")}>
                          {validating ? "Validation..." : "✅ Valider (contrôle stock)"}
                        </button>
                      )}
                    </div>
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
    </AppShell>
  );
}
