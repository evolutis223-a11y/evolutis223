"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { AppShell, type ShellModule } from "@/components/app-shell";
import {
  accorderAvance,
  accorderPret,
  ajouterBesoinSaisonnier,
  ajouterPersonnel,
  basculerActifPersonnel,
  calculerCommissionSuggeree,
  changerStatutBesoin,
  changerStatutIncident,
  declarerIncident,
  genererBulletin,
  marquerBulletinPaye,
  soldeAvance,
  soldePret,
} from "./actions";

type Personnel = {
  id: number;
  matricule: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  fonction: string | null;
  departement: string | null;
  typeContrat: string;
  dureeContrat: string | null;
  utilisateurId: number | null;
  salaireBase: number;
  tauxCommission: number | null;
  actif: boolean;
  dateEmbauche: string | null;
  pretActif: { id: number; montant: number; mensualite: number; soldeRestant: number } | null;
  avanceActive: { id: number; montant: number; date: string } | null;
};
type Bulletin = {
  id: number;
  personnelId: number;
  personnelNom: string;
  periode: string;
  salaireBase: number;
  primeTransport: number;
  commission: number;
  retenueInps: number;
  avance: number;
  netAPayer: number;
  statut: string;
};
type UtilisateurOpt = { id: number; nom: string };
type Incident = {
  id: number;
  personnelId: number;
  personnelNom: string;
  type: string;
  dateIncident: string;
  description: string | null;
  impact: string | null;
  obligationsLegales: string | null;
  statut: string;
};
type Besoin = {
  id: number;
  titre: string;
  fonction: string | null;
  nombrePersonnesRequis: number;
  periodeDebut: string;
  periodeFin: string;
  notes: string | null;
  statut: string;
};

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}
function moisCourant() {
  return new Date().toISOString().slice(0, 7);
}
function ajourdhui() {
  return new Date().toISOString().slice(0, 10);
}
const TYPE_LABELS: Record<string, string> = { SALARIE: "Salarié", JOURNALIER: "Journalier", PARTENAIRE: "Partenaire" };
const INCIDENT_TYPE_LABELS: Record<string, string> = {
  MALADIE: "Maladie",
  BLESSURE: "Blessure",
  DECES: "Décès",
  CATASTROPHE_NATURELLE: "Catastrophe naturelle",
  BLOCAGE_RECRUTEMENT: "Blocage de recrutement",
  AUTRE: "Autre",
};
const CONTRAT_COLOR: Record<string, string> = { CDI: "#10b981", CDD: "#f59e0b", Stagiaire: "#3b82f6" };

const inputStyle: CSSProperties = {
  width: "100%",
  background: "#121212",
  border: "1px solid #333",
  color: "#e0e0e0",
  padding: "10px 12px",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box",
};
function darkButton(bg: string, color = "#fff"): CSSProperties {
  return { background: bg, color, border: "none", padding: "9px 16px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" };
}
const docInputStyle: CSSProperties = {
  width: 120,
  textAlign: "right",
  border: "1px solid #ddd",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 13,
  color: "#000",
  background: "#fafafa",
};

export function RhClient({
  userName,
  roleLibelle,
  modules,
  personnel: initialPersonnel,
  bulletins: initialBulletins,
  utilisateurs,
  incidents: initialIncidents,
  besoins: initialBesoins,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  personnel: Personnel[];
  bulletins: Bulletin[];
  utilisateurs: UtilisateurOpt[];
  incidents: Incident[];
  besoins: Besoin[];
}) {
  const [tab, setTab] = useState<"employes" | "partenaires" | "paie" | "incidents" | "previsions">("employes");
  const [personnel, setPersonnel] = useState(initialPersonnel);
  const [bulletins, setBulletins] = useState(initialBulletins);
  const [incidents, setIncidents] = useState(initialIncidents);
  const [besoins, setBesoins] = useState(initialBesoins);

  const employes = useMemo(() => personnel.filter((p) => p.typeContrat === "SALARIE"), [personnel]);
  const partenaires = useMemo(() => personnel.filter((p) => p.typeContrat !== "SALARIE"), [personnel]);

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="RH" modules={modules}>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16, height: "calc(100vh - 118px)", boxSizing: "border-box", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 4, background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: 4, width: "fit-content", flexShrink: 0 }}>
          <button
            onClick={() => setTab("employes")}
            style={{ background: tab === "employes" ? "#3b82f6" : "transparent", color: tab === "employes" ? "#fff" : "#888", border: "none", padding: "9px 16px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            Employés
          </button>
          <button
            onClick={() => setTab("partenaires")}
            style={{ background: tab === "partenaires" ? "#3b82f6" : "transparent", color: tab === "partenaires" ? "#fff" : "#888", border: "none", padding: "9px 16px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            🤝 Partenaires &amp; Journaliers
          </button>
          <div style={{ width: 1, background: "#333", margin: "4px 6px" }} />
          <button
            onClick={() => setTab("paie")}
            style={{ background: tab === "paie" ? "#333" : "transparent", color: tab === "paie" ? "#fff" : "#666", border: "none", padding: "9px 16px", borderRadius: 6, fontSize: 12.5, cursor: "pointer" }}
          >
            Paie
          </button>
          <button
            onClick={() => setTab("incidents")}
            style={{ background: tab === "incidents" ? "#333" : "transparent", color: tab === "incidents" ? "#fff" : "#666", border: "none", padding: "9px 16px", borderRadius: 6, fontSize: 12.5, cursor: "pointer" }}
          >
            Incidents
          </button>
          <button
            onClick={() => setTab("previsions")}
            style={{ background: tab === "previsions" ? "#333" : "transparent", color: tab === "previsions" ? "#fff" : "#666", border: "none", padding: "9px 16px", borderRadius: 6, fontSize: 12.5, cursor: "pointer" }}
          >
            Prévisions
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          {tab === "employes" && <EmployesTab personnel={employes} setPersonnel={setPersonnel} utilisateurs={utilisateurs} bulletins={bulletins} />}
          {tab === "partenaires" && <PartenairesTab personnel={partenaires} setPersonnel={setPersonnel} utilisateurs={utilisateurs} bulletins={bulletins} setBulletins={setBulletins} />}
          {tab === "paie" && (
            <div style={{ overflowY: "auto", height: "100%" }}>
              <PaieTab personnel={personnel} bulletins={bulletins} setBulletins={setBulletins} />
            </div>
          )}
          {tab === "incidents" && (
            <div style={{ overflowY: "auto", height: "100%" }}>
              <IncidentsTab personnel={personnel} incidents={incidents} setIncidents={setIncidents} />
            </div>
          )}
          {tab === "previsions" && (
            <div style={{ overflowY: "auto", height: "100%" }}>
              <PrevisionsTab besoins={besoins} setBesoins={setBesoins} />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function FormulaireEmploye({
  typeContratDefaut,
  utilisateurs,
  onCreated,
  onClose,
}: {
  typeContratDefaut: string;
  utilisateurs: UtilisateurOpt[];
  onCreated: (p: Personnel) => void;
  onClose: () => void;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [fonction, setFonction] = useState("");
  const [departement, setDepartement] = useState("");
  const [typeContrat, setTypeContrat] = useState(typeContratDefaut);
  const [dureeContrat, setDureeContrat] = useState("CDI");
  const [salaireBase, setSalaireBase] = useState("");
  const [tauxCommission, setTauxCommission] = useState("");
  const [utilisateurId, setUtilisateurId] = useState("");
  const [pending, setPending] = useState(false);

  async function handleAdd() {
    setPending(true);
    setErreur(null);
    const fd = new FormData();
    fd.set("nom", nom);
    fd.set("telephone", telephone);
    fd.set("email", email);
    fd.set("fonction", fonction);
    fd.set("departement", departement);
    fd.set("typeContrat", typeContrat);
    fd.set("dureeContrat", dureeContrat);
    fd.set("salaireBase", salaireBase || "0");
    fd.set("tauxCommission", tauxCommission);
    fd.set("utilisateurId", utilisateurId);
    const res = await ajouterPersonnel({ error: null }, fd);
    setPending(false);
    if (res.error || !res.personnelId) {
      setErreur(res.error ?? "Erreur.");
      return;
    }
    onCreated({
      id: res.personnelId,
      matricule: "…",
      nom,
      telephone: telephone || null,
      email: email || null,
      fonction: fonction || null,
      departement: departement || null,
      typeContrat,
      dureeContrat: typeContrat === "SALARIE" ? dureeContrat : null,
      utilisateurId: utilisateurId ? Number(utilisateurId) : null,
      salaireBase: Number(salaireBase || 0),
      tauxCommission: tauxCommission ? Number(tauxCommission) : null,
      actif: true,
      dateEmbauche: null,
      pretActif: null,
      avanceActive: null,
    });
  }

  return (
    <div style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: 16, marginBottom: 14, flexShrink: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <input placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} style={inputStyle} />
        <input placeholder="Téléphone" value={telephone} onChange={(e) => setTelephone(e.target.value)} style={inputStyle} />
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        <input placeholder="Poste" value={fonction} onChange={(e) => setFonction(e.target.value)} style={inputStyle} />
        <input placeholder="Département" value={departement} onChange={(e) => setDepartement(e.target.value)} style={inputStyle} />
        <select value={typeContrat} onChange={(e) => setTypeContrat(e.target.value)} style={inputStyle}>
          <option value="SALARIE">Salarié</option>
          <option value="JOURNALIER">Journalier</option>
          <option value="PARTENAIRE">Partenaire</option>
        </select>
        {typeContrat === "SALARIE" && (
          <select value={dureeContrat} onChange={(e) => setDureeContrat(e.target.value)} style={inputStyle}>
            <option value="CDI">CDI</option>
            <option value="CDD">CDD</option>
            <option value="Stagiaire">Stagiaire</option>
          </select>
        )}
        <input type="number" placeholder="Salaire de base (FCFA)" value={salaireBase} onChange={(e) => setSalaireBase(e.target.value)} style={inputStyle} />
        <input type="number" placeholder="Taux commission % (optionnel)" value={tauxCommission} onChange={(e) => setTauxCommission(e.target.value)} style={inputStyle} />
        <select value={utilisateurId} onChange={(e) => setUtilisateurId(e.target.value)} style={{ ...inputStyle, gridColumn: "span 2" }}>
          <option value="">Compte applicatif lié (optionnel — requis pour la commission)</option>
          {utilisateurs.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nom}
            </option>
          ))}
        </select>
      </div>
      {erreur && <p style={{ marginTop: 8, fontSize: 12.5, color: "#f87171" }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={handleAdd} disabled={pending || !nom.trim()} style={darkButton("#10b981")}>
          {pending ? "Ajout..." : "Enregistrer"}
        </button>
        <button onClick={onClose} style={darkButton("#333")}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function derniersMois(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
const MOIS_LABEL: Record<string, string> = {
  "01": "janv.", "02": "févr.", "03": "mars", "04": "avr.", "05": "mai", "06": "juin",
  "07": "juil.", "08": "août", "09": "sept.", "10": "oct.", "11": "nov.", "12": "déc.",
};

function EmployesTab({
  personnel,
  setPersonnel,
  utilisateurs,
  bulletins,
}: {
  personnel: Personnel[];
  setPersonnel: (fn: (p: Personnel[]) => Personnel[]) => void;
  utilisateurs: UtilisateurOpt[];
  bulletins: Bulletin[];
}) {
  const [search, setSearch] = useState("");
  const [filtreContrat, setFiltreContrat] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formOuvert, setFormOuvert] = useState(false);
  const [periodeHisto, setPeriodeHisto] = useState<6 | 12>(6);

  const filtres = useMemo(() => {
    const q = search.trim().toLowerCase();
    return personnel.filter(
      (p) =>
        (!q || p.nom.toLowerCase().includes(q) || (p.fonction ?? "").toLowerCase().includes(q) || (p.departement ?? "").toLowerCase().includes(q)) &&
        (!filtreContrat || p.dureeContrat === filtreContrat)
    );
  }, [personnel, search, filtreContrat]);

  const selected = personnel.find((p) => p.id === selectedId) ?? null;

  const stats = useMemo(() => {
    const nbCDI = personnel.filter((p) => p.dureeContrat === "CDI").length;
    const nbCDD = personnel.filter((p) => p.dureeContrat === "CDD").length;
    const nbStagiaire = personnel.filter((p) => p.dureeContrat === "Stagiaire").length;
    const nbPretsEnCours = personnel.filter((p) => p.pretActif).length;
    const nbAvancesEnCours = personnel.filter((p) => p.avanceActive).length;
    const totalPretsRestant = personnel.reduce((s, p) => s + (p.pretActif?.soldeRestant ?? 0), 0);
    const masseSalariale = personnel.reduce((s, p) => s + p.salaireBase, 0);
    return { nbTotal: personnel.length, nbCDI, nbCDD, nbStagiaire, nbPretsEnCours, nbAvancesEnCours, totalPretsRestant, masseSalariale };
  }, [personnel]);

  const historique = useMemo(() => {
    const mois = derniersMois(periodeHisto);
    return mois.map((periode) => ({
      periode,
      total: bulletins.filter((b) => b.periode === periode).reduce((s, b) => s + b.netAPayer, 0),
    }));
  }, [bulletins, periodeHisto]);
  const maxHisto = Math.max(1, ...historique.map((h) => h.total));

  return (
    <div style={{ display: "flex", gap: 20, height: "100%" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Personnel</div>
          <button onClick={() => setFormOuvert((v) => !v)} style={darkButton("#3b82f6")}>
            + Nouvel employé
          </button>
        </div>
        {formOuvert && (
          <FormulaireEmploye
            typeContratDefaut="SALARIE"
            utilisateurs={utilisateurs}
            onClose={() => setFormOuvert(false)}
            onCreated={(p) => {
              setPersonnel((prev) => [...prev, p]);
              setFormOuvert(false);
            }}
          />
        )}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexShrink: 0 }}>
          <input placeholder="Rechercher (nom, poste, département...)" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <select value={filtreContrat} onChange={(e) => setFiltreContrat(e.target.value)} style={{ ...inputStyle, width: 140, flexShrink: 0 }}>
            <option value="">Tous contrats</option>
            <option value="CDI">CDI</option>
            <option value="CDD">CDD</option>
            <option value="Stagiaire">Stagiaire</option>
          </select>
        </div>
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, border: "1px solid #262626", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ width: "14%", padding: 10, borderBottom: "1px solid #333", textAlign: "left", color: "#888", fontSize: 11.5, position: "sticky", top: 0, background: "#151515" }}>N°</th>
                <th style={{ width: "30%", padding: 10, borderBottom: "1px solid #333", textAlign: "left", color: "#888", fontSize: 11.5, position: "sticky", top: 0, background: "#151515" }}>Nom</th>
                <th style={{ width: "26%", padding: 10, borderBottom: "1px solid #333", textAlign: "left", color: "#888", fontSize: 11.5, position: "sticky", top: 0, background: "#151515" }}>Poste</th>
                <th style={{ width: "16%", padding: 10, borderBottom: "1px solid #333", textAlign: "left", color: "#888", fontSize: 11.5, position: "sticky", top: 0, background: "#151515" }}>Contrat</th>
                <th style={{ width: "14%", padding: 10, borderBottom: "1px solid #333", textAlign: "right", color: "#888", fontSize: 11.5, position: "sticky", top: 0, background: "#151515" }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtres.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  style={{ cursor: "pointer", background: selectedId === p.id ? "#263041" : "transparent", opacity: p.actif ? 1 : 0.5 }}
                >
                  <td style={{ padding: 10, borderBottom: "1px solid #262626", fontSize: 12.5, color: "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.matricule}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #262626", fontSize: 12.5, color: "#e0e0e0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nom}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #262626", fontSize: 12.5, color: "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.fonction ?? "—"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #262626", fontSize: 12.5, fontWeight: 700, color: p.dureeContrat ? CONTRAT_COLOR[p.dureeContrat] : "#888" }}>{p.dureeContrat ?? "—"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #262626", textAlign: "right", whiteSpace: "nowrap" }}>
                    {p.pretActif && (
                      <span title="Prêt en cours" style={{ marginRight: 4 }}>
                        🏦
                      </span>
                    )}
                    {p.avanceActive && <span title="Avance prise">💵</span>}
                  </td>
                </tr>
              ))}
              {filtres.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#666", fontSize: 13 }}>
                    Aucun employé.
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
              Aperçu RH — cliquez sur un employé pour voir sa fiche
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
                <span style={{ color: "#888", fontSize: 13 }}>Employés</span>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>{stats.nbTotal}</div>
              </div>
              <div style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
                <span style={{ color: "#888", fontSize: 13 }}>CDI</span>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981" }}>{stats.nbCDI}</div>
              </div>
              <div style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
                <span style={{ color: "#888", fontSize: 13 }}>CDD</span>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>{stats.nbCDD}</div>
              </div>
              <div style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
                <span style={{ color: "#888", fontSize: 13 }}>Stagiaires</span>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>{stats.nbStagiaire}</div>
              </div>
            </div>
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #333" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, padding: "6px 0" }}>
                <span>🏦 Employés avec prêt en cours</span>
                <span style={{ color: "#f59e0b", fontWeight: 700 }}>{stats.nbPretsEnCours}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, padding: "6px 0" }}>
                <span>💵 Employés avec avance en cours</span>
                <span style={{ color: "#3b82f6", fontWeight: 700 }}>{stats.nbAvancesEnCours}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, padding: "6px 0" }}>
                <span>Solde total des prêts restant</span>
                <span style={{ color: "#dc2626", fontWeight: 700 }}>{fmt(stats.totalPretsRestant)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, padding: "6px 0" }}>
                <span>Masse salariale mensuelle</span>
                <span style={{ color: "#10b981", fontWeight: 700 }}>{fmt(stats.masseSalariale)}</span>
              </div>
            </div>
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #333" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>Historique des payes</div>
                <div style={{ display: "flex", gap: 4, background: "#121212", border: "1px solid #333", borderRadius: 6, padding: 3 }}>
                  <button
                    onClick={() => setPeriodeHisto(6)}
                    style={{ background: periodeHisto === 6 ? "#3b82f6" : "transparent", color: periodeHisto === 6 ? "#fff" : "#888", border: "none", padding: "4px 10px", borderRadius: 4, fontSize: 11.5, cursor: "pointer" }}
                  >
                    6 mois
                  </button>
                  <button
                    onClick={() => setPeriodeHisto(12)}
                    style={{ background: periodeHisto === 12 ? "#3b82f6" : "transparent", color: periodeHisto === 12 ? "#fff" : "#888", border: "none", padding: "4px 10px", borderRadius: 4, fontSize: 11.5, cursor: "pointer" }}
                  >
                    12 mois
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90 }}>
                {historique.map((h) => (
                  <div key={h.periode} title={`${h.periode} — ${fmt(h.total)}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                    <div style={{ width: "100%", maxWidth: 22, height: `${Math.max(3, (h.total / maxHisto) * 70)}px`, background: h.total > 0 ? "#3b82f6" : "#262626", borderRadius: "3px 3px 0 0" }} />
                    <div style={{ fontSize: 9.5, color: "#666" }}>{MOIS_LABEL[h.periode.slice(5)]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <FicheEmploye
            employe={selected}
            onToggleActif={async () => {
              await basculerActifPersonnel(selected.id, !selected.actif);
              setPersonnel((prev) => prev.map((x) => (x.id === selected.id ? { ...x, actif: !x.actif } : x)));
            }}
            onPret={(pret) => setPersonnel((prev) => prev.map((x) => (x.id === selected.id ? { ...x, pretActif: pret } : x)))}
            onAvance={(avance) => setPersonnel((prev) => prev.map((x) => (x.id === selected.id ? { ...x, avanceActive: avance } : x)))}
          />
        )}
      </div>
    </div>
  );
}

function FicheEmploye({
  employe,
  onToggleActif,
  onPret,
  onAvance,
}: {
  employe: Personnel;
  onToggleActif: () => void;
  onPret: (pret: Personnel["pretActif"]) => void;
  onAvance: (avance: Personnel["avanceActive"]) => void;
}) {
  const [montantPret, setMontantPret] = useState("");
  const [mensualitePret, setMensualitePret] = useState("");
  const [montantAvance, setMontantAvance] = useState("");
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function handlePret() {
    setPending(true);
    setErreur(null);
    const res = await accorderPret(employe.id, Number(montantPret), Number(mensualitePret));
    setPending(false);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    onPret({ id: -1, montant: Number(montantPret), mensualite: Number(mensualitePret), soldeRestant: Number(montantPret) });
    setMontantPret("");
    setMensualitePret("");
  }

  async function handleSoldePret() {
    if (!employe.pretActif) return;
    await soldePret(employe.pretActif.id);
    onPret(null);
  }

  async function handleAvance() {
    setPending(true);
    setErreur(null);
    const res = await accorderAvance(employe.id, Number(montantAvance));
    setPending(false);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    onAvance({ id: -1, montant: Number(montantAvance), date: ajourdhui() });
    setMontantAvance("");
  }

  async function handleSoldeAvance() {
    if (!employe.avanceActive) return;
    await soldeAvance(employe.avanceActive.id);
    onAvance(null);
  }

  return (
    <div style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: 24, flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 18, flexShrink: 0 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#121212", border: "1px solid #333", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#888", flexShrink: 0, textAlign: "center" }}>
          Photo
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#666" }}>{employe.matricule}</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: "#fff" }}>{employe.nom}</div>
          <div style={{ fontSize: 13, color: "#888" }}>
            {employe.fonction ?? "—"} — {employe.departement ?? "—"}
          </div>
          {employe.dureeContrat && (
            <div style={{ display: "inline-block", marginTop: 6, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, color: "#fff", background: CONTRAT_COLOR[employe.dureeContrat] ?? "#666" }}>
              {employe.dureeContrat}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexShrink: 0 }}>
          <button onClick={onToggleActif} style={{ background: "none", border: `1px solid ${employe.actif ? "#dc2626" : "#10b981"}`, color: employe.actif ? "#dc2626" : "#10b981", padding: "7px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
            {employe.actif ? "Supprimer" : "Réactiver"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "8px 0", borderBottom: "1px solid #262626" }}>
        <span>Date d&apos;embauche</span>
        <span>{employe.dateEmbauche ?? "—"}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "8px 0", borderBottom: "1px solid #262626" }}>
        <span>Salaire mensuel</span>
        <span>{fmt(employe.salaireBase)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "8px 0", borderBottom: "1px solid #262626" }}>
        <span>Téléphone</span>
        <span>{employe.telephone ?? "—"}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "8px 0", borderBottom: "1px solid #262626" }}>
        <span>Email</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{employe.email ?? "—"}</span>
      </div>

      <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #333" }}>
        <div style={{ fontSize: 13, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Prêt en cours</div>
        {employe.pretActif ? (
          <div style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "3px 0" }}>
              <span>Montant du prêt</span>
              <span>{fmt(employe.pretActif.montant)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "3px 0" }}>
              <span>Mensualité</span>
              <span>{fmt(employe.pretActif.mensualite)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "3px 0", fontWeight: 700, color: "#f59e0b" }}>
              <span>Solde restant</span>
              <span>{fmt(employe.pretActif.soldeRestant)}</span>
            </div>
            <button onClick={handleSoldePret} style={{ ...darkButton("#333"), marginTop: 10, fontSize: 11.5 }}>
              Marquer soldé
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="number" placeholder="Montant" value={montantPret} onChange={(e) => setMontantPret(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <input type="number" placeholder="Mensualité" value={mensualitePret} onChange={(e) => setMensualitePret(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={handlePret} disabled={pending || !montantPret || !mensualitePret} style={darkButton("#3b82f6")}>
              Accorder
            </button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Avance sur salaire</div>
        {employe.avanceActive ? (
          <div style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "3px 0" }}>
              <span>Montant de l&apos;avance</span>
              <span>{fmt(employe.avanceActive.montant)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "3px 0", color: "#888" }}>
              <span>Date</span>
              <span>{employe.avanceActive.date}</span>
            </div>
            <button onClick={handleSoldeAvance} style={{ ...darkButton("#333"), marginTop: 10, fontSize: 11.5 }}>
              Marquer soldée
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="number" placeholder="Montant" value={montantAvance} onChange={(e) => setMontantAvance(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={handleAvance} disabled={pending || !montantAvance} style={darkButton("#3b82f6")}>
              Accorder
            </button>
          </div>
        )}
      </div>
      {erreur && <p style={{ marginTop: 12, fontSize: 12.5, color: "#f87171" }}>{erreur}</p>}
    </div>
  );
}

function PartenairesTab({
  personnel,
  setPersonnel,
  utilisateurs,
  bulletins,
  setBulletins,
}: {
  personnel: Personnel[];
  setPersonnel: (fn: (p: Personnel[]) => Personnel[]) => void;
  utilisateurs: UtilisateurOpt[];
  bulletins: Bulletin[];
  setBulletins: (fn: (b: Bulletin[]) => Bulletin[]) => void;
}) {
  const [formOuvert, setFormOuvert] = useState(false);
  const [payantId, setPayantId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const brouillonParPersonnel = useMemo(() => {
    const m = new Map<number, Bulletin>();
    for (const b of bulletins) if (b.statut === "BROUILLON" && !m.has(b.personnelId)) m.set(b.personnelId, b);
    return m;
  }, [bulletins]);

  const nbEnAttente = personnel.filter((p) => brouillonParPersonnel.has(p.id)).length;
  const totalDu = personnel.reduce((s, p) => s + (brouillonParPersonnel.get(p.id)?.netAPayer ?? 0), 0);
  const selected = personnel.find((p) => p.id === selectedId) ?? null;

  async function handlePayer(personnelId: number) {
    const bulletin = brouillonParPersonnel.get(personnelId);
    if (!bulletin) return;
    setPayantId(personnelId);
    const res = await marquerBulletinPaye(bulletin.id);
    setPayantId(null);
    if (!res.error) {
      setBulletins((prev) => prev.map((b) => (b.id === bulletin.id ? { ...b, statut: "PAYE" } : b)));
    }
  }

  return (
    <div style={{ display: "flex", gap: 20, height: "100%" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Partenaires &amp; journaliers</div>
          <button onClick={() => setFormOuvert((v) => !v)} style={darkButton("#3b82f6")}>
            + Nouveau partenaire
          </button>
        </div>
        {formOuvert && (
          <FormulaireEmploye
            typeContratDefaut="JOURNALIER"
            utilisateurs={utilisateurs}
            onClose={() => setFormOuvert(false)}
            onCreated={(p) => {
              setPersonnel((prev) => [...prev, p]);
              setFormOuvert(false);
            }}
          />
        )}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, border: "1px solid #262626", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ width: "40%", padding: 10, borderBottom: "1px solid #333", textAlign: "left", color: "#888", fontSize: 11.5, position: "sticky", top: 0, background: "#151515" }}>Nom</th>
                <th style={{ width: "30%", padding: 10, borderBottom: "1px solid #333", textAlign: "left", color: "#888", fontSize: 11.5, position: "sticky", top: 0, background: "#151515" }}>Type</th>
                <th style={{ width: "30%", padding: 10, borderBottom: "1px solid #333", textAlign: "right", color: "#888", fontSize: 11.5, position: "sticky", top: 0, background: "#151515" }}>Dû</th>
              </tr>
            </thead>
            <tbody>
              {personnel.map((p) => {
                const du = brouillonParPersonnel.get(p.id);
                return (
                  <tr key={p.id} onClick={() => setSelectedId(p.id)} style={{ cursor: "pointer", background: selectedId === p.id ? "#263041" : "transparent" }}>
                    <td style={{ padding: 10, borderBottom: "1px solid #262626", fontSize: 12.5, color: "#e0e0e0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nom}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #262626", fontSize: 12.5, color: "#888" }}>{TYPE_LABELS[p.typeContrat]}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #262626", fontSize: 12.5, textAlign: "right", fontWeight: 700, color: du ? "#f59e0b" : "#10b981" }}>{du ? fmt(du.netAPayer) : "Réglé"}</td>
                  </tr>
                );
              })}
              {personnel.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: 20, textAlign: "center", color: "#666", fontSize: 13 }}>
                    Aucun partenaire ou journalier.
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
              Aperçu partenariats — cliquez sur un nom pour voir son bilan
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
                <span style={{ color: "#888", fontSize: 13 }}>Partenaires &amp; journaliers</span>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>{personnel.length}</div>
              </div>
              <div style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
                <span style={{ color: "#888", fontSize: 13 }}>En attente de paiement</span>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>{nbEnAttente}</div>
              </div>
            </div>
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #333" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, padding: "6px 0" }}>
                <span>Total dû (commissions &amp; journées)</span>
                <span style={{ color: "#dc2626", fontWeight: 700 }}>{fmt(totalDu)}</span>
              </div>
            </div>
            <div style={{ marginTop: 16, fontSize: 11.5, color: "#666" }}>
              Chaque paiement enregistre automatiquement une Dépense « Salaires/Commissions » dans le module Dépenses.
            </div>
          </div>
        ) : (
          (() => {
            const historiquePersonne = bulletins.filter((b) => b.personnelId === selected.id).sort((a, b) => b.periode.localeCompare(a.periode));
            const totalVerse = historiquePersonne.filter((b) => b.statut === "PAYE").reduce((s, b) => s + b.netAPayer, 0);
            const du = brouillonParPersonnel.get(selected.id);
            return (
              <div style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: 24, flex: 1, overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                  <div>
                    <div style={{ fontSize: 19, fontWeight: 700, color: "#fff" }}>{selected.nom}</div>
                    <div style={{ fontSize: 13, color: "#888" }}>
                      {TYPE_LABELS[selected.typeContrat]} {selected.fonction ? `— ${selected.fonction}` : ""}
                    </div>
                  </div>
                  {du ? (
                    <button onClick={() => handlePayer(selected.id)} disabled={payantId === selected.id} style={darkButton("#10b981")}>
                      {payantId === selected.id ? "..." : "💵 Payer"}
                    </button>
                  ) : (
                    <span style={{ background: "none", border: "1px solid #10b981", color: "#10b981", padding: "9px 16px", borderRadius: 6, fontSize: 13, fontWeight: 700 }}>✔ Réglé</span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                  <div style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
                    <span style={{ color: "#888", fontSize: 12 }}>Montant dû actuellement</span>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#f59e0b" }}>{fmt(du?.netAPayer ?? 0)}</div>
                  </div>
                  <div style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
                    <span style={{ color: "#888", fontSize: 12 }}>Total versé (historique)</span>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#10b981" }}>{fmt(totalVerse)}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Historique des paiements</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {historiquePersonne.map((b) => (
                    <div key={b.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "1px solid #262626" }}>
                      <span style={{ color: "#ccc" }}>{b.periode}</span>
                      <span style={{ color: b.statut === "PAYE" ? "#10b981" : "#f59e0b" }}>{fmt(b.netAPayer)} — {b.statut === "PAYE" ? "Payé" : "En attente"}</span>
                    </div>
                  ))}
                  {historiquePersonne.length === 0 && <p style={{ fontSize: 13, color: "#666" }}>Aucun paiement enregistré pour l&apos;instant.</p>}
                </div>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}

function PaieTab({
  personnel,
  bulletins,
  setBulletins,
}: {
  personnel: Personnel[];
  bulletins: Bulletin[];
  setBulletins: (fn: (b: Bulletin[]) => Bulletin[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filtres = useMemo(() => {
    const q = search.trim().toLowerCase();
    return personnel.filter((p) => p.actif && (!q || p.nom.toLowerCase().includes(q)));
  }, [personnel, search]);

  const selected = personnel.find((p) => p.id === selectedId) ?? null;

  const etatGeneral = useMemo(() => {
    const moisActuel = moisCourant();
    const duMois = bulletins.filter((b) => b.periode === moisActuel);
    const nbPaye = duMois.filter((b) => b.statut === "PAYE").length;
    const nbEnAttente = duMois.filter((b) => b.statut === "BROUILLON").length;
    const totalPaye = duMois.filter((b) => b.statut === "PAYE").reduce((s, b) => s + b.netAPayer, 0);
    const totalEnAttente = duMois.filter((b) => b.statut === "BROUILLON").reduce((s, b) => s + b.netAPayer, 0);
    const masseSalariale = personnel.filter((p) => p.actif).reduce((s, p) => s + p.salaireBase, 0);
    return { nbPaye, nbEnAttente, totalPaye, totalEnAttente, masseSalariale };
  }, [bulletins, personnel]);

  return (
    <div style={{ display: "flex", gap: 20, height: "100%" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16, flexShrink: 0 }}>Personnel</div>
        <input placeholder="Rechercher (nom...)" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, marginBottom: 12, flexShrink: 0 }} />
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, border: "1px solid #262626", borderRadius: 8 }}>
          {filtres.map((p) => {
            const dernier = bulletins.filter((b) => b.personnelId === p.id).sort((a, b) => b.periode.localeCompare(a.periode))[0];
            return (
              <div
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                style={{ padding: "12px 14px", borderBottom: "1px solid #262626", cursor: "pointer", background: selectedId === p.id ? "#263041" : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "#e0e0e0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{p.matricule}</div>
                </div>
                {dernier && (
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: dernier.statut === "PAYE" ? "#10b981" : "#f59e0b", flexShrink: 0 }}>{dernier.periode}</span>
                )}
              </div>
            );
          })}
          {filtres.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#666", fontSize: 13 }}>Aucun personnel.</div>}
        </div>
      </div>

      <div style={{ flex: 1.3, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {!selected ? (
          <div style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: 28, flex: 1, overflowY: "auto" }}>
            <div style={{ fontSize: 13, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>
              État général des payes — {moisCourant()}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
                <span style={{ color: "#888", fontSize: 13 }}>Payés ce mois</span>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981" }}>{etatGeneral.nbPaye}</div>
              </div>
              <div style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
                <span style={{ color: "#888", fontSize: 13 }}>En attente</span>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>{etatGeneral.nbEnAttente}</div>
              </div>
            </div>
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #333" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, padding: "6px 0" }}>
                <span>Total payé ce mois</span>
                <span style={{ color: "#10b981", fontWeight: 700 }}>{fmt(etatGeneral.totalPaye)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, padding: "6px 0" }}>
                <span>Total en attente</span>
                <span style={{ color: "#f59e0b", fontWeight: 700 }}>{fmt(etatGeneral.totalEnAttente)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, padding: "6px 0" }}>
                <span>Masse salariale (personnel actif)</span>
                <span style={{ color: "#3b82f6", fontWeight: 700 }}>{fmt(etatGeneral.masseSalariale)}</span>
              </div>
            </div>
          </div>
        ) : (
          <FichePaieDetail personnel={selected} bulletins={bulletins} setBulletins={setBulletins} />
        )}
      </div>
    </div>
  );
}

function FichePaieDetail({
  personnel,
  bulletins,
  setBulletins,
}: {
  personnel: Personnel;
  bulletins: Bulletin[];
  setBulletins: (fn: (b: Bulletin[]) => Bulletin[]) => void;
}) {
  const historiquePersonne = useMemo(
    () => bulletins.filter((b) => b.personnelId === personnel.id).sort((a, b) => b.periode.localeCompare(a.periode)),
    [bulletins, personnel.id]
  );
  const [periode, setPeriode] = useState(historiquePersonne[0]?.periode ?? moisCourant());
  const bulletinCourant = historiquePersonne.find((b) => b.periode === periode);

  const [salaireBase, setSalaireBase] = useState(bulletinCourant?.salaireBase ?? personnel.salaireBase);
  const [primeTransport, setPrimeTransport] = useState(bulletinCourant?.primeTransport ?? 0);
  const [commission, setCommission] = useState(bulletinCourant?.commission ?? 0);
  const [retenueInps, setRetenueInps] = useState(bulletinCourant?.retenueInps ?? 0);
  const [avance, setAvance] = useState(bulletinCourant?.avance ?? 0);
  const [suggesting, setSuggesting] = useState(false);
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [periodeInitiale] = useState(periode);

  const netAPayer = salaireBase + primeTransport + commission - retenueInps - avance;
  const totalVerse = historiquePersonne.filter((b) => b.statut === "PAYE").reduce((s, b) => s + b.netAPayer, 0);
  const nbPaye = historiquePersonne.filter((b) => b.statut === "PAYE").length;

  function chargerPeriode(nouvellePeriode: string) {
    setPeriode(nouvellePeriode);
    const b = historiquePersonne.find((x) => x.periode === nouvellePeriode);
    setSalaireBase(b?.salaireBase ?? personnel.salaireBase);
    setPrimeTransport(b?.primeTransport ?? 0);
    setCommission(b?.commission ?? 0);
    setRetenueInps(b?.retenueInps ?? 0);
    setAvance(b?.avance ?? 0);
  }

  async function handleSuggererCommission() {
    setSuggesting(true);
    const val = await calculerCommissionSuggeree(personnel.id, periode);
    setCommission(Math.round(val));
    setSuggesting(false);
  }

  async function handleGenerer() {
    setPending(true);
    setErreur(null);
    const res = await genererBulletin({ personnelId: personnel.id, periode, salaireBase, primeTransport, commission, retenueInps, avance });
    setPending(false);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    setBulletins((prev) => {
      const existing = prev.find((b) => b.id === res.bulletinId);
      const nouveau: Bulletin = { id: res.bulletinId!, personnelId: personnel.id, personnelNom: personnel.nom, periode, salaireBase, primeTransport, commission, retenueInps, avance, netAPayer, statut: "BROUILLON" };
      if (existing) return prev.map((b) => (b.id === res.bulletinId ? nouveau : b));
      return [nouveau, ...prev];
    });
  }

  async function handleMarquerPaye() {
    if (!bulletinCourant) return;
    setErreur(null);
    const res = await marquerBulletinPaye(bulletinCourant.id);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    setBulletins((prev) => prev.map((b) => (b.id === bulletinCourant.id ? { ...b, statut: "PAYE" } : b)));
  }

  const periodesDisponibles = useMemo(() => {
    const set = new Set(historiquePersonne.map((b) => b.periode));
    set.add(periodeInitiale);
    set.add(moisCourant());
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [historiquePersonne, periodeInitiale]);

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#fff", color: "#000", borderRadius: 8, padding: 22, fontFamily: "Arial,sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>FICHE DE PAIE</div>
            <div style={{ fontSize: 12, color: "#444", marginTop: 2 }}>
              {personnel.nom} — {personnel.matricule}
            </div>
            <div style={{ fontSize: 11, color: "#666" }}>{personnel.fonction ?? "—"}</div>
          </div>
          <select value={periode} onChange={(e) => chargerPeriode(e.target.value)} style={{ border: "1px solid #ccc", borderRadius: 6, padding: "6px 10px", fontSize: 12.5, background: "#fafafa" }}>
            {periodesDisponibles.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <tbody>
            <tr>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>Salaire de base</td>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #eee", textAlign: "right", width: 140 }}>
                <input type="number" value={salaireBase} onChange={(e) => setSalaireBase(Number(e.target.value))} style={docInputStyle} />
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>Prime transport</td>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #eee", textAlign: "right" }}>
                <input type="number" value={primeTransport} onChange={(e) => setPrimeTransport(Number(e.target.value))} style={docInputStyle} />
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
                Commission
                {personnel.tauxCommission != null && personnel.utilisateurId != null && (
                  <button onClick={handleSuggererCommission} disabled={suggesting} style={{ marginLeft: 8, background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontSize: 11 }}>
                    {suggesting ? "..." : `Suggérer (${personnel.tauxCommission}%)`}
                  </button>
                )}
              </td>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #eee", textAlign: "right" }}>
                <input type="number" value={commission} onChange={(e) => setCommission(Number(e.target.value))} style={docInputStyle} />
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>Retenue INPS</td>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #eee", textAlign: "right" }}>
                <input type="number" value={retenueInps} onChange={(e) => setRetenueInps(Number(e.target.value))} style={docInputStyle} />
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>Avance déjà versée</td>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #eee", textAlign: "right" }}>
                <input type="number" value={avance} onChange={(e) => setAvance(Number(e.target.value))} style={docInputStyle} />
              </td>
            </tr>
            <tr>
              <td style={{ padding: "10px 0", fontWeight: 800, fontSize: 15 }}>NET À PAYER</td>
              <td style={{ padding: "10px 0", fontWeight: 800, fontSize: 15, textAlign: "right" }}>{fmt(netAPayer)}</td>
            </tr>
          </tbody>
        </table>
        {bulletinCourant && (
          <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: bulletinCourant.statut === "PAYE" ? "#166534" : "#b45309" }}>
            STATUT : {bulletinCourant.statut === "PAYE" ? "PAYÉ" : "BROUILLON"}
          </div>
        )}
      </div>

      {erreur && <p style={{ fontSize: 12.5, color: "#f87171" }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button onClick={handleGenerer} disabled={pending} style={darkButton("#3b82f6")}>
          {pending ? "..." : bulletinCourant ? "Enregistrer les modifications" : "Générer le bulletin"}
        </button>
        {bulletinCourant && bulletinCourant.statut === "BROUILLON" && (
          <button onClick={handleMarquerPaye} style={darkButton("#10b981")}>
            Marquer payé
          </button>
        )}
        {bulletinCourant && (
          <a href={`/api/documents/fiche-paie/${bulletinCourant.id}`} target="_blank" rel="noopener noreferrer" style={{ ...darkButton("#333"), textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            PDF
          </a>
        )}
      </div>

      <div style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 10 }}>
          <span style={{ color: "#888" }}>Total versé depuis l&apos;embauche</span>
          <span style={{ color: "#10b981", fontWeight: 700 }}>{fmt(totalVerse)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 12 }}>
          <span style={{ color: "#888" }}>Bulletins payés</span>
          <span style={{ color: "#fff", fontWeight: 700 }}>{nbPaye}</span>
        </div>
        <div style={{ fontSize: 11.5, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Historique</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {historiquePersonne.map((b) => (
            <div
              key={b.id}
              onClick={() => chargerPeriode(b.periode)}
              style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 8px", borderRadius: 6, cursor: "pointer", background: b.periode === periode ? "#263041" : "transparent" }}
            >
              <span style={{ color: "#ccc" }}>{b.periode}</span>
              <span style={{ color: b.statut === "PAYE" ? "#10b981" : "#f59e0b" }}>{fmt(b.netAPayer)}</span>
            </div>
          ))}
          {historiquePersonne.length === 0 && <p style={{ fontSize: 12.5, color: "#666" }}>Aucun bulletin encore généré.</p>}
        </div>
      </div>
    </div>
  );
}

function IncidentsTab({
  personnel,
  incidents,
  setIncidents,
}: {
  personnel: Personnel[];
  incidents: Incident[];
  setIncidents: (fn: (i: Incident[]) => Incident[]) => void;
}) {
  const [personnelId, setPersonnelId] = useState("");
  const [type, setType] = useState("MALADIE");
  const [dateIncident, setDateIncident] = useState(ajourdhui());
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState("");
  const [obligationsLegales, setObligationsLegales] = useState("");
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function handleDeclarer() {
    if (!personnelId) {
      setErreur("Personnel requis.");
      return;
    }
    setPending(true);
    setErreur(null);
    const fd = new FormData();
    fd.set("personnelId", personnelId);
    fd.set("type", type);
    fd.set("dateIncident", dateIncident);
    fd.set("description", description);
    fd.set("impact", impact);
    fd.set("obligationsLegales", obligationsLegales);
    const res = await declarerIncident({ error: null }, fd);
    setPending(false);
    if (res.error || !res.incidentId) {
      setErreur(res.error ?? "Erreur.");
      return;
    }
    const p = personnel.find((x) => x.id === Number(personnelId));
    setIncidents((prev) => [
      { id: res.incidentId!, personnelId: Number(personnelId), personnelNom: p?.nom ?? "", type, dateIncident, description: description || null, impact: impact || null, obligationsLegales: obligationsLegales || null, statut: "DECLARE" },
      ...prev,
    ]);
    setDescription("");
    setImpact("");
    setObligationsLegales("");
  }

  async function handleStatut(id: number, statut: string) {
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, statut } : i)));
    await changerStatutIncident(id, statut);
  }

  const parType = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of incidents) m.set(i.type, (m.get(i.type) ?? 0) + 1);
    return m;
  }, [incidents]);
  const nbNonResolu = incidents.filter((i) => i.statut !== "RESOLU").length;

  return (
    <div style={{ display: "flex", gap: 20, height: "100%" }}>
    <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
      <p style={{ marginBottom: 12, fontSize: 12, color: "#888" }}>
        Événements humains touchant le personnel — maladie, blessure, décès, catastrophe naturelle, blocage de recrutement. Le champ « obligations légales » est
        une saisie libre : aucune règle de droit du travail n&apos;est déduite ou codée en dur ici, à vérifier au cas par cas.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {incidents.map((i) => (
          <div key={i.id} style={{ borderRadius: 8, border: "1px solid #333", background: "#1e1e1e", padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                  {INCIDENT_TYPE_LABELS[i.type] ?? i.type} — {i.personnelNom}
                </div>
                <div style={{ fontSize: 11.5, color: "#888" }}>{i.dateIncident}</div>
              </div>
              <select value={i.statut} onChange={(e) => handleStatut(i.id, e.target.value)} style={{ ...inputStyle, width: "auto", height: 28, fontSize: 11.5, padding: "2px 6px" }}>
                <option value="DECLARE">Déclaré</option>
                <option value="EN_COURS">En cours</option>
                <option value="RESOLU">Résolu</option>
              </select>
            </div>
            {i.description && <p style={{ marginTop: 6, fontSize: 12, color: "#e0e0e0" }}>{i.description}</p>}
            {i.impact && <p style={{ marginTop: 4, fontSize: 12, color: "#888" }}>Impact : {i.impact}</p>}
            {i.obligationsLegales && <p style={{ marginTop: 4, fontSize: 12, color: "#888" }}>Obligations légales : {i.obligationsLegales}</p>}
          </div>
        ))}
        {incidents.length === 0 && <p style={{ fontSize: 13, color: "#666" }}>Aucun incident déclaré.</p>}
      </div>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8, borderRadius: 8, border: "1px solid #333", background: "#1e1e1e", padding: 12 }}>
        <select value={personnelId} onChange={(e) => setPersonnelId(e.target.value)} style={inputStyle}>
          <option value="">Personnel concerné...</option>
          {personnel.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
            {Object.entries(INCIDENT_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input type="date" value={dateIncident} onChange={(e) => setDateIncident(e.target.value)} style={inputStyle} />
        </div>
        <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
        <input placeholder="Impact opérationnel (ex. absence 2 semaines, remplacement nécessaire)" value={impact} onChange={(e) => setImpact(e.target.value)} style={inputStyle} />
        <input placeholder="Obligations légales (à vérifier vous-même, non déduites automatiquement)" value={obligationsLegales} onChange={(e) => setObligationsLegales(e.target.value)} style={inputStyle} />
        <button onClick={handleDeclarer} disabled={pending || !personnelId} style={darkButton("#3b82f6")}>
          {pending ? "Déclaration..." : "Déclarer l'incident"}
        </button>
        {erreur && <p style={{ fontSize: 12.5, color: "#f87171" }}>{erreur}</p>}
      </div>
    </div>

    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: 28 }}>
        <div style={{ fontSize: 13, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>État des incidents</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          <div style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
            <span style={{ color: "#888", fontSize: 13 }}>Total incidents</span>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>{incidents.length}</div>
          </div>
          <div style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
            <span style={{ color: "#888", fontSize: 13 }}>Non résolus</span>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#dc2626" }}>{nbNonResolu}</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Répartition par type</div>
        {Object.entries(INCIDENT_TYPE_LABELS).map(([v, l]) => (
          <div key={v} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "6px 0", borderBottom: "1px solid #262626" }}>
            <span>{l}</span>
            <span style={{ fontWeight: 700 }}>{parType.get(v) ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}

function PrevisionsTab({ besoins, setBesoins }: { besoins: Besoin[]; setBesoins: (fn: (b: Besoin[]) => Besoin[]) => void }) {
  const [titre, setTitre] = useState("");
  const [fonction, setFonction] = useState("");
  const [nombrePersonnesRequis, setNombrePersonnesRequis] = useState("1");
  const [periodeDebut, setPeriodeDebut] = useState("");
  const [periodeFin, setPeriodeFin] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function handleAjouter() {
    if (!titre.trim() || !periodeDebut || !periodeFin) {
      setErreur("Titre et période requis.");
      return;
    }
    setPending(true);
    setErreur(null);
    const fd = new FormData();
    fd.set("titre", titre);
    fd.set("fonction", fonction);
    fd.set("nombrePersonnesRequis", nombrePersonnesRequis);
    fd.set("periodeDebut", periodeDebut);
    fd.set("periodeFin", periodeFin);
    fd.set("notes", notes);
    const res = await ajouterBesoinSaisonnier({ error: null }, fd);
    setPending(false);
    if (res.error || !res.besoinId) {
      setErreur(res.error ?? "Erreur.");
      return;
    }
    setBesoins((prev) => [
      { id: res.besoinId!, titre, fonction: fonction || null, nombrePersonnesRequis: Number(nombrePersonnesRequis), periodeDebut, periodeFin, notes: notes || null, statut: "PLANIFIE" },
      ...prev,
    ]);
    setTitre("");
    setFonction("");
    setNombrePersonnesRequis("1");
    setPeriodeDebut("");
    setPeriodeFin("");
    setNotes("");
  }

  async function handleStatut(id: number, statut: string) {
    setBesoins((prev) => prev.map((b) => (b.id === id ? { ...b, statut } : b)));
    await changerStatutBesoin(id, statut);
  }

  const parStatut = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of besoins) m.set(b.statut, (m.get(b.statut) ?? 0) + 1);
    return m;
  }, [besoins]);
  const totalPersonnesRecherchees = besoins.filter((b) => b.statut !== "POURVU" && b.statut !== "ANNULE").reduce((s, b) => s + b.nombrePersonnesRequis, 0);

  return (
    <div style={{ display: "flex", gap: 20, height: "100%" }}>
    <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
      <p style={{ marginBottom: 12, fontSize: 12, color: "#888" }}>Planification des besoins de personnel à venir — renfort saisonnier, contrats partenaires, recrutement à anticiper.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {besoins.map((b) => (
          <div key={b.id} style={{ borderRadius: 8, border: "1px solid #333", background: "#1e1e1e", padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{b.titre}</div>
                <div style={{ fontSize: 11.5, color: "#888" }}>
                  {b.fonction ? `${b.fonction} · ` : ""}
                  {b.nombrePersonnesRequis} pers. · {b.periodeDebut} → {b.periodeFin}
                </div>
              </div>
              <select value={b.statut} onChange={(e) => handleStatut(b.id, e.target.value)} style={{ ...inputStyle, width: "auto", height: 28, fontSize: 11.5, padding: "2px 6px" }}>
                <option value="PLANIFIE">Planifié</option>
                <option value="EN_COURS">En cours</option>
                <option value="POURVU">Pourvu</option>
                <option value="ANNULE">Annulé</option>
              </select>
            </div>
            {b.notes && <p style={{ marginTop: 6, fontSize: 12, color: "#888" }}>{b.notes}</p>}
          </div>
        ))}
        {besoins.length === 0 && <p style={{ fontSize: 13, color: "#666" }}>Aucun besoin planifié.</p>}
      </div>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8, borderRadius: 8, border: "1px solid #333", background: "#1e1e1e", padding: 12 }}>
        <input placeholder="Titre (ex. Renfort saison pluvieuse 2026)" value={titre} onChange={(e) => setTitre(e.target.value)} style={inputStyle} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input placeholder="Fonction recherchée" value={fonction} onChange={(e) => setFonction(e.target.value)} style={inputStyle} />
          <input type="number" min={1} placeholder="Nombre de personnes" value={nombrePersonnesRequis} onChange={(e) => setNombrePersonnesRequis(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input type="date" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)} style={inputStyle} />
          <input type="date" value={periodeFin} onChange={(e) => setPeriodeFin(e.target.value)} style={inputStyle} />
        </div>
        <input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} />
        <button onClick={handleAjouter} disabled={pending || !titre.trim()} style={darkButton("#3b82f6")}>
          {pending ? "Ajout..." : "Ajouter le besoin"}
        </button>
        {erreur && <p style={{ fontSize: 12.5, color: "#f87171" }}>{erreur}</p>}
      </div>
    </div>

    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: 28 }}>
        <div style={{ fontSize: 13, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>État des prévisions</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          <div style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
            <span style={{ color: "#888", fontSize: 13 }}>Besoins actifs</span>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>{besoins.filter((b) => b.statut !== "ANNULE").length}</div>
          </div>
          <div style={{ background: "#121212", border: "1px solid #333", borderRadius: 8, padding: 16 }}>
            <span style={{ color: "#888", fontSize: 13 }}>Personnes recherchées</span>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>{totalPersonnesRecherchees}</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Répartition par statut</div>
        {[["PLANIFIE", "Planifié"], ["EN_COURS", "En cours"], ["POURVU", "Pourvu"], ["ANNULE", "Annulé"]].map(([v, l]) => (
          <div key={v} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "6px 0", borderBottom: "1px solid #262626" }}>
            <span>{l}</span>
            <span style={{ fontWeight: 700 }}>{parStatut.get(v) ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
