"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell, type ShellModule } from "@/components/app-shell";
import type { bonsDecaissement, cloturesCaisse, utilisateurs } from "@/db/schema";
import {
  ajouterChargeFixe,
  cloturerCaisse,
  creerBonDecaissement,
  creerPret,
  definirObjectifCa,
  definirSeuilDecaissement,
  modifierChargeFixe,
  rembourserPret,
  supprimerChargeFixe,
  validerBonDecaissement,
  type BonState,
  type ClotureState,
} from "./actions";

type Bon = Omit<typeof bonsDecaissement.$inferSelect, "montant"> & { montant: number; valide: boolean };
type Cloture = Omit<typeof cloturesCaisse.$inferSelect, "soldeTheorique" | "comptageReel" | "ecart"> & {
  soldeTheorique: number;
  comptageReel: number;
  ecart: number;
};
type Utilisateur = typeof utilisateurs.$inferSelect;
type Periode = "jour" | "semaine" | "mois";
type CaBloc = { ca: number; coutMatiere: number; beneficeBrut: number; beneficeNet: number };
type ChargeFixe = { id: number; nom: string; montantEstime: number; montantReelMois: number };
type Pret = {
  id: number;
  type: string;
  preteurNom: string;
  montant: number;
  montantRembourse: number;
  montantRestant: number;
  statut: string;
  dateEcheance: string | null;
};
type ReglementAttente = { id: number; montant: number; mode: string; payeurNom: string | null; payeurTelephone: string | null; reference: string | null };

function formatFcfa(v: number) {
  return `${Math.round(v).toLocaleString("fr-FR")} FCFA`;
}
function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("fr-FR");
}

const CATEGORIE_LABEL: Record<string, string> = {
  ACHAT_MARCHANDISE: "🛒 Achat marchandise",
  CHARGE_GENERAL: "🏢 Charge générale",
  RH_SALAIRE: "👥 RH — Salaire",
};
const MODE_LABEL: Record<string, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  VIREMENT: "Virement",
  CHEQUE: "Chèque",
};
const PRET_TYPE_LABEL: Record<string, string> = {
  BANCAIRE: "🏦 Prêt bancaire",
  PERSONNEL: "🤝 Prêt personnel",
  PROPRIETAIRE: "👤 Avance personnelle (propriétaire)",
};

const initialBonState: BonState = { error: null };
const initialClotureState: ClotureState = { error: null };

const TABS = [
  { key: "apercu", label: "Vue d'ensemble" },
  { key: "decaissements", label: "Décaissements" },
  { key: "clotures", label: "Clôtures de caisse" },
  { key: "objectifs", label: "Objectifs & Prévisions" },
  { key: "prets", label: "Prêts" },
  { key: "parametres", label: "Paramètres" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function TresorerieClient(props: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  utilisateurs: Utilisateur[];
  currentUserId: number;
  isAdmin: boolean;
  clotureAujourdhuiExiste: boolean;
  bons: Bon[];
  clotures: Cloture[];
  seuilValidation: number;
  soldeTheoriqueAujourdhui: number;
  chargesFixes: ChargeFixe[];
  budgetMensuelEstime: number;
  objectifs: { JOUR: number; SEMAINE: number; MOIS: number };
  prets: Pret[];
  compteAttente: ReglementAttente[];
  ca: { jour: CaBloc; semaine: CaBloc; mois: CaBloc };
  rh: { masseSalariale: number; nbActifs: number; payeCeMois: number };
  repartitionMois: Record<string, number>;
  decaisseMoisValide: number;
  nbEnAttenteValidation: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("apercu");
  const nomAuteur = (id: number) => props.utilisateurs.find((u) => u.id === id)?.nom ?? "—";
  const refresh = () => router.refresh();

  return (
    <AppShell userName={props.userName} roleLibelle={props.roleLibelle} pageTitle="Trésorerie" modules={props.modules}>
      <div className="mx-auto max-w-5xl space-y-5 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Trésorerie</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Décaissements, clôtures de caisse, objectifs et prêts — un seul écran, une seule permission.
          </p>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "apercu" && (
          <ApercuTab
            ca={props.ca}
            objectifs={props.objectifs}
            compteAttente={props.compteAttente}
            nbEnAttenteValidation={props.nbEnAttenteValidation}
            soldeTheoriqueAujourdhui={props.soldeTheoriqueAujourdhui}
            decaisseMoisValide={props.decaisseMoisValide}
            repartitionMois={props.repartitionMois}
            chargesFixes={props.chargesFixes}
            rh={props.rh}
          />
        )}

        {tab === "decaissements" && (
          <DecaissementsTab
            bons={props.bons}
            chargesFixes={props.chargesFixes}
            nomAuteur={nomAuteur}
            seuil={props.seuilValidation}
            currentUserId={props.currentUserId}
            onChanged={refresh}
          />
        )}

        {tab === "clotures" && (
          <CloturesTab
            clotures={props.clotures}
            clotureAujourdhuiExiste={props.clotureAujourdhuiExiste}
            soldeTheoriqueAujourdhui={props.soldeTheoriqueAujourdhui}
            onChanged={refresh}
          />
        )}

        {tab === "objectifs" && (
          <ObjectifsTab
            chargesFixes={props.chargesFixes}
            budgetMensuelEstime={props.budgetMensuelEstime}
            objectifs={props.objectifs}
            ca={props.ca}
            decaisseMoisValide={props.decaisseMoisValide}
            onChanged={refresh}
          />
        )}

        {tab === "prets" && <PretsTab prets={props.prets} onChanged={refresh} />}

        {tab === "parametres" && (
          <div className="max-w-sm">
            <SeuilEditor seuil={props.seuilValidation} isAdmin={props.isAdmin} onDone={refresh} />
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ---- Vue d'ensemble ----

function ApercuTab({
  ca,
  objectifs,
  compteAttente,
  nbEnAttenteValidation,
  soldeTheoriqueAujourdhui,
  decaisseMoisValide,
  repartitionMois,
  chargesFixes,
  rh,
}: {
  ca: { jour: CaBloc; semaine: CaBloc; mois: CaBloc };
  objectifs: { JOUR: number; SEMAINE: number; MOIS: number };
  compteAttente: ReglementAttente[];
  nbEnAttenteValidation: number;
  soldeTheoriqueAujourdhui: number;
  decaisseMoisValide: number;
  repartitionMois: Record<string, number>;
  chargesFixes: ChargeFixe[];
  rh: { masseSalariale: number; nbActifs: number; payeCeMois: number };
}) {
  const [periode, setPeriode] = useState<"semaine" | "mois">("semaine");
  const objectifJour = objectifs.JOUR;
  const pctJour = objectifJour > 0 ? Math.min(100, Math.round((ca.jour.ca / objectifJour) * 100)) : 0;
  const totalAchatsChargesRh = (repartitionMois.ACHAT_MARCHANDISE ?? 0) + (repartitionMois.CHARGE_GENERAL ?? 0) + (repartitionMois.RH_SALAIRE ?? 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/30 bg-gradient-to-b from-primary/5 to-transparent p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-sm font-semibold text-foreground">En ce moment — aujourd&apos;hui</span>
          <span className="ml-auto text-[11px] text-muted-foreground">mis à jour à l&apos;instant</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card/60 p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Ventes du jour</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">{formatFcfa(ca.jour.ca)}</div>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-card/60 p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Bénéfice brut (jour)</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-500">{formatFcfa(ca.jour.beneficeBrut)}</div>
          </div>
          <div className="rounded-lg border border-primary/30 bg-card/60 p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Bénéfice net théorique (jour)</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-primary">{formatFcfa(ca.jour.beneficeNet)}</div>
          </div>
        </div>
        {objectifJour > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
              <span>Objectif du jour</span>
              <span className="tabular-nums">
                {pctJour}% — {formatFcfa(ca.jour.ca)} / {formatFcfa(objectifJour)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pctJour}%` }} />
            </div>
          </div>
        )}
      </div>

      {compteAttente.length > 0 && (
        <div className="rounded-md border border-purple-500/40 bg-purple-500/10 p-3 text-sm text-purple-300">
          💤 {compteAttente.length} paiement(s) reçu(s) ({formatFcfa(compteAttente.reduce((s, r) => s + r.montant, 0))}) en{" "}
          <b>compte d&apos;attente</b> — non identifiés ou pas encore rattachés à une affaire.
          <ComptesAttenteListe reglements={compteAttente} />
        </div>
      )}

      {nbEnAttenteValidation > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-500">
          ⚠️ {nbEnAttenteValidation} bon(s) de décaissement en attente de validation hiérarchique.
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground">Comparatif chiffre d&apos;affaires &amp; bénéfice</div>
          <div className="flex overflow-hidden rounded-md border border-border">
            <button
              onClick={() => setPeriode("semaine")}
              className={`px-3 py-1 text-xs font-semibold ${periode === "semaine" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Semaine
            </button>
            <button
              onClick={() => setPeriode("mois")}
              className={`px-3 py-1 text-xs font-semibold ${periode === "mois" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Mois
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="CA" value={formatFcfa(ca[periode].ca)} />
          <Stat label="Coût matière (PMP)" value={formatFcfa(ca[periode].coutMatiere)} />
          <Stat label="Bénéfice théorique" value={formatFcfa(ca[periode].beneficeBrut)} accent="success" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat label="Décaissé ce mois (validé)" value={formatFcfa(decaisseMoisValide)} />
        <Stat label="Solde théorique — aujourd'hui" value={formatFcfa(soldeTheoriqueAujourdhui)} accent="success" />
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold text-foreground">Répartition du mois par catégorie</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex justify-between border-b border-border pb-2 text-xs font-bold text-foreground">
              <span>🛒 Achats marchandise</span>
              <span className="tabular-nums text-primary">{formatFcfa(repartitionMois.ACHAT_MARCHANDISE ?? 0)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Détail par fournisseur/lot disponible dans Achats.</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex justify-between border-b border-border pb-2 text-xs font-bold text-foreground">
              <span>🏢 Charges générales</span>
              <span className="tabular-nums text-primary">{formatFcfa(repartitionMois.CHARGE_GENERAL ?? 0)}</span>
            </div>
            {chargesFixes.slice(0, 4).map((c) => (
              <div key={c.id} className="flex justify-between py-0.5 text-xs text-muted-foreground">
                <span>{c.nom}</span>
                <span className="tabular-nums">{formatFcfa(c.montantReelMois)}</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex justify-between border-b border-border pb-2 text-xs font-bold text-foreground">
              <span>👥 RH — Personnel</span>
              <span className="tabular-nums text-primary">{formatFcfa(rh.payeCeMois)}</span>
            </div>
            <div className="flex justify-between py-0.5 text-xs text-muted-foreground">
              <span>Masse salariale (RH)</span>
              <span className="tabular-nums">{formatFcfa(rh.masseSalariale)}</span>
            </div>
            <div className="flex justify-between py-0.5 text-xs text-muted-foreground">
              <span>Employés actifs</span>
              <span className="tabular-nums">{rh.nbActifs}</span>
            </div>
            <a href="/rh" className="mt-1.5 block text-xs font-semibold text-primary hover:underline">
              → Voir le détail par employé dans RH
            </a>
          </div>
        </div>
        {totalAchatsChargesRh === 0 && <p className="mt-2 text-xs text-muted-foreground">Aucun décaissement validé ce mois-ci pour l&apos;instant.</p>}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "success" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1.5 text-xl font-bold tabular-nums ${accent === "success" ? "text-emerald-500" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function ComptesAttenteListe({ reglements }: { reglements: ReglementAttente[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button onClick={() => setOpen((o) => !o)} className="font-semibold underline">
        {open ? "Masquer" : "Clarifier →"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {reglements.map((r) => (
            <ReglementAttenteRow key={r.id} reglement={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReglementAttenteRow({ reglement }: { reglement: ReglementAttente }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-purple-500/30 bg-card/60 p-2 text-xs text-foreground">
      <div>
        <b className="tabular-nums">{formatFcfa(reglement.montant)}</b> — {MODE_LABEL[reglement.mode] ?? reglement.mode}
        {reglement.reference && <span className="text-muted-foreground"> · réf. {reglement.reference}</span>}
        {(reglement.payeurNom || reglement.payeurTelephone) && (
          <span className="text-muted-foreground">
            {" "}
            · {reglement.payeurNom ?? ""} {reglement.payeurTelephone ?? ""}
          </span>
        )}
      </div>
      <a href="/reglements" className="font-semibold text-purple-300 hover:underline">
        Rattacher dans Règlements →
      </a>
    </div>
  );
}

// ---- Décaissements ----

function DecaissementsTab({
  bons,
  chargesFixes,
  nomAuteur,
  seuil,
  currentUserId,
  onChanged,
}: {
  bons: Bon[];
  chargesFixes: ChargeFixe[];
  nomAuteur: (id: number) => string;
  seuil: number;
  currentUserId: number;
  onChanged: () => void;
}) {
  const [filtre, setFiltre] = useState<string | null>(null);
  const filtres = bons.filter((b) => !filtre || b.categorie === filtre);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFiltre(null)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${!filtre ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
          >
            Tous
          </button>
          {Object.entries(CATEGORIE_LABEL).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFiltre(k)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${filtre === k ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <BonForm chargesFixes={chargesFixes} onCreated={onChanged} />

      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Catégorie</th>
              <th className="px-3 py-2">Montant</th>
              <th className="px-3 py-2">Motif</th>
              <th className="px-3 py-2">Auteur</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtres.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Aucun bon.
                </td>
              </tr>
            )}
            {filtres.map((b) => (
              <BonRow key={b.id} bon={b} auteurNom={nomAuteur(b.auteurId)} seuil={seuil} currentUserId={currentUserId} onValidated={onChanged} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BonRow({
  bon,
  auteurNom,
  seuil,
  currentUserId,
  onValidated,
}: {
  bon: Bon;
  auteurNom: string;
  seuil: number;
  currentUserId: number;
  onValidated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const depasseSeuil = bon.montant > seuil;
  const bloqueAutoValidation = depasseSeuil && bon.auteurId === currentUserId && !bon.validateurId;

  async function handleValider() {
    setBusy(true);
    setErreur(null);
    const res = await validerBonDecaissement(bon.id);
    setBusy(false);
    if (res.error) setErreur(res.error);
    onValidated();
  }
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-1.5">{CATEGORIE_LABEL[bon.categorie]}</td>
      <td className="px-3 py-1.5 tabular-nums">
        {formatFcfa(bon.montant)}
        {depasseSeuil && (
          <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            &gt; seuil
          </span>
        )}
      </td>
      <td className="px-3 py-1.5">{bon.motif}</td>
      <td className="px-3 py-1.5 text-xs text-muted-foreground">{auteurNom}</td>
      <td className="px-3 py-1.5">
        {bon.validateurId ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Validé
          </span>
        ) : bloqueAutoValidation ? (
          <span className="text-xs text-muted-foreground" title="Un autre utilisateur doit valider ce bon">
            Validation hiérarchique requise
          </span>
        ) : (
          <Button size="sm" variant="outline" disabled={busy} onClick={handleValider}>
            Valider
          </Button>
        )}
        {erreur && <p className="mt-1 text-xs text-destructive">{erreur}</p>}
      </td>
    </tr>
  );
}

function BonForm({ chargesFixes, onCreated }: { chargesFixes: ChargeFixe[]; onCreated: () => void }) {
  const [state, action, pending] = useActionState(creerBonDecaissement, initialBonState);
  const [categorie, setCategorie] = useState("CHARGE_GENERAL");
  const [formKey, setFormKey] = useState(0);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setFormKey((k) => k + 1);
      onCreated();
    }
    wasPending.current = pending;
  }, [pending, state.error, onCreated]);

  return (
    <form key={formKey} action={action} className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-card p-3">
      <select
        name="categorie"
        value={categorie}
        onChange={(e) => setCategorie(e.target.value)}
        className="flex h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm"
        required
      >
        <option value="ACHAT_MARCHANDISE">Achat marchandise</option>
        <option value="CHARGE_GENERAL">Charge générale</option>
        <option value="RH_SALAIRE">RH / Salaire</option>
      </select>
      {categorie === "CHARGE_GENERAL" && chargesFixes.length > 0 && (
        <select name="chargeFixeId" className="flex h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm">
          <option value="">Type de charge (optionnel)...</option>
          {chargesFixes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
      )}
      <Input name="montant" type="number" min="1" placeholder="Montant" className="w-32" required />
      <Input name="motif" placeholder="Motif" className="w-56" required />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "..." : "Enregistrer le bon"}
      </Button>
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
    </form>
  );
}

// ---- Clôtures ----

function CloturesTab({
  clotures,
  clotureAujourdhuiExiste,
  soldeTheoriqueAujourdhui,
  onChanged,
}: {
  clotures: Cloture[];
  clotureAujourdhuiExiste: boolean;
  soldeTheoriqueAujourdhui: number;
  onChanged: () => void;
}) {
  return (
    <div className="space-y-4">
      {clotureAujourdhuiExiste ? (
        <p className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">La caisse d&apos;aujourd&apos;hui est déjà clôturée.</p>
      ) : (
        <ClotureForm soldeTheorique={soldeTheoriqueAujourdhui} onDone={onChanged} />
      )}

      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Théorique</th>
              <th className="px-3 py-2">Comptage</th>
              <th className="px-3 py-2">Écart</th>
              <th className="px-3 py-2">Justification</th>
            </tr>
          </thead>
          <tbody>
            {clotures.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Aucune clôture encore.
                </td>
              </tr>
            )}
            {clotures.map((c) => (
              <tr key={c.dateCloture} className="border-t border-border">
                <td className="px-3 py-1.5">{c.dateCloture}</td>
                <td className="px-3 py-1.5 tabular-nums">{formatFcfa(c.soldeTheorique)}</td>
                <td className="px-3 py-1.5 tabular-nums">{formatFcfa(c.comptageReel)}</td>
                <td className="px-3 py-1.5 tabular-nums">{formatFcfa(c.ecart ?? 0)}</td>
                <td className="px-3 py-1.5 text-xs text-muted-foreground">{c.justification ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClotureForm({ soldeTheorique, onDone }: { soldeTheorique: number; onDone: () => void }) {
  const [state, action, pending] = useActionState(cloturerCaisse, initialClotureState);
  const [comptage, setComptage] = useState("");
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) onDone();
    wasPending.current = pending;
  }, [pending, state.error, onDone]);

  const ecart = comptage ? Number(comptage) - soldeTheorique : 0;

  return (
    <form action={action} className="space-y-3 rounded-md border border-border bg-card p-4">
      <div className="text-sm text-muted-foreground">
        Solde théorique du jour (règlements espèces − décaissements) : <b className="text-foreground tabular-nums">{formatFcfa(soldeTheorique)}</b>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Comptage réel</label>
          <Input name="comptageReel" type="number" min="0" value={comptage} onChange={(e) => setComptage(e.target.value)} className="w-32" required />
        </div>
        {comptage && Math.abs(ecart) > 0.01 && (
          <div className="text-sm">
            <span className="text-muted-foreground">Écart : </span>
            <span className={ecart < 0 ? "font-semibold text-destructive" : "font-semibold text-emerald-500"}>
              {ecart > 0 ? "+" : ""}
              {formatFcfa(ecart)}
            </span>
          </div>
        )}
      </div>
      {comptage && Math.abs(ecart) > 0.01 && (
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Justification (requise en cas d&apos;écart)</label>
          <Input name="justification" placeholder="Ex. rendu monnaie mal compté" />
        </div>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Clôture..." : "Clôturer la caisse du jour"}
      </Button>
    </form>
  );
}

// ---- Objectifs & Prévisions ----

function ObjectifsTab({
  chargesFixes,
  budgetMensuelEstime,
  objectifs,
  ca,
  decaisseMoisValide,
  onChanged,
}: {
  chargesFixes: ChargeFixe[];
  budgetMensuelEstime: number;
  objectifs: { JOUR: number; SEMAINE: number; MOIS: number };
  ca: { jour: CaBloc; semaine: CaBloc; mois: CaBloc };
  decaisseMoisValide: number;
  onChanged: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 text-sm font-semibold text-foreground">Charges fixes mensuelles estimées</div>
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2">Poste</th>
                <th className="px-3 py-2 text-right">Montant estimé</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {chargesFixes.map((c) => (
                <ChargeFixeRow key={c.id} charge={c} onChanged={onChanged} />
              ))}
              {chargesFixes.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Aucune charge fixe enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <AjouterChargeFixeForm onCreated={onChanged} />
        <div className="mt-3 flex items-baseline justify-between rounded-md border border-primary bg-primary/10 px-4 py-3 text-sm font-bold text-foreground">
          <span>Budget mensuel estimé (charges fixes + masse salariale RH)</span>
          <span className="tabular-nums">{formatFcfa(budgetMensuelEstime)}</span>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold text-foreground">Réel du mois vs budget</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="CA réalisé" value={formatFcfa(ca.mois.ca)} accent="success" />
          <Stat label="Dépenses réelles" value={formatFcfa(decaisseMoisValide)} />
          <Stat label="Écart vs budget estimé" value={formatFcfa(ca.mois.ca - budgetMensuelEstime)} accent={ca.mois.ca >= budgetMensuelEstime ? "success" : undefined} />
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold text-foreground">Objectifs de chiffre d&apos;affaires</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ObjectifCard label="Objectif du jour" periode="JOUR" objectif={objectifs.JOUR} reel={ca.jour.ca} onChanged={onChanged} />
          <ObjectifCard label="Objectif de la semaine" periode="SEMAINE" objectif={objectifs.SEMAINE} reel={ca.semaine.ca} onChanged={onChanged} />
          <ObjectifCard label="Objectif du mois" periode="MOIS" objectif={objectifs.MOIS} reel={ca.mois.ca} onChanged={onChanged} />
        </div>
      </div>
    </div>
  );
}

function ChargeFixeRow({ charge, onChanged }: { charge: ChargeFixe; onChanged: () => void }) {
  const [montant, setMontant] = useState(String(charge.montantEstime));
  const [busy, setBusy] = useState(false);

  async function handleBlur() {
    const n = Number(montant);
    if (!Number.isFinite(n) || n === charge.montantEstime) return;
    setBusy(true);
    await modifierChargeFixe(charge.id, n);
    setBusy(false);
    onChanged();
  }

  async function handleSupprimer() {
    setBusy(true);
    await supprimerChargeFixe(charge.id);
    setBusy(false);
    onChanged();
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-1.5">{charge.nom}</td>
      <td className="px-3 py-1.5 text-right">
        <Input
          type="number"
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
          onBlur={handleBlur}
          disabled={busy}
          className="ml-auto h-8 w-32 text-right"
        />
      </td>
      <td className="px-3 py-1.5 text-right">
        <button onClick={handleSupprimer} disabled={busy} className="text-xs text-muted-foreground hover:text-destructive">
          ×
        </button>
      </td>
    </tr>
  );
}

function AjouterChargeFixeForm({ onCreated }: { onCreated: () => void }) {
  const [nom, setNom] = useState("");
  const [montant, setMontant] = useState("");
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function handleAjouter() {
    setPending(true);
    setErreur(null);
    const res = await ajouterChargeFixe(nom, Number(montant));
    setPending(false);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    setNom("");
    setMontant("");
    onCreated();
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Input placeholder="Nom de la charge (ex. Frais carte bancaire)" value={nom} onChange={(e) => setNom(e.target.value)} className="w-64" />
      <Input type="number" placeholder="Montant estimé" value={montant} onChange={(e) => setMontant(e.target.value)} className="w-40" />
      <Button size="sm" variant="outline" disabled={pending || !nom || !montant} onClick={handleAjouter}>
        + Ajouter une ligne
      </Button>
      {erreur && <span className="text-xs text-destructive">{erreur}</span>}
    </div>
  );
}

function ObjectifCard({
  label,
  periode,
  objectif,
  reel,
  onChanged,
}: {
  label: string;
  periode: "JOUR" | "SEMAINE" | "MOIS";
  objectif: number;
  reel: number;
  onChanged: () => void;
}) {
  const [valeur, setValeur] = useState(String(objectif));
  const [busy, setBusy] = useState(false);
  const pct = objectif > 0 ? Math.min(100, Math.round((reel / objectif) * 100)) : 0;

  async function handleBlur() {
    const n = Number(valeur);
    if (!Number.isFinite(n) || n === objectif) return;
    setBusy(true);
    await definirObjectifCa(periode, n);
    setBusy(false);
    onChanged();
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-lg font-bold tabular-nums text-foreground">
        {formatFcfa(reel)} <span className="text-sm font-semibold text-muted-foreground">/ {formatFcfa(objectif)}</span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <Input type="number" value={valeur} onChange={(e) => setValeur(e.target.value)} onBlur={handleBlur} disabled={busy} className="mt-3 h-8 text-xs" />
    </div>
  );
}

// ---- Prêts ----

function PretsTab({ prets, onChanged }: { prets: Pret[]; onChanged: () => void }) {
  const [ouvrir, setOuvrir] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
        ℹ️ Un prêt reçu n&apos;est jamais compté comme chiffre d&apos;affaires, et son remboursement n&apos;est jamais compté comme une charge — uniquement suivi ici, séparément du bénéfice.
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-foreground">Prêts en cours</div>
        <Button size="sm" onClick={() => setOuvrir((o) => !o)}>
          {ouvrir ? "Annuler" : "+ Nouveau prêt"}
        </Button>
      </div>

      {ouvrir && <NouveauPretForm onCreated={() => { setOuvrir(false); onChanged(); }} />}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {prets.map((p) => (
          <PretCard key={p.id} pret={p} onChanged={onChanged} />
        ))}
        {prets.length === 0 && <p className="text-sm text-muted-foreground">Aucun prêt enregistré.</p>}
      </div>
    </div>
  );
}

function PretCard({ pret, onChanged }: { pret: Pret; onChanged: () => void }) {
  const [montant, setMontant] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const pct = pret.montant > 0 ? Math.round((pret.montantRembourse / pret.montant) * 100) : 0;

  async function handleRembourser() {
    const n = Number(montant);
    if (!Number.isFinite(n) || n <= 0) {
      setErreur("Montant invalide.");
      return;
    }
    setBusy(true);
    setErreur(null);
    const res = await rembourserPret(pret.id, n);
    setBusy(false);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    setMontant("");
    onChanged();
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-primary">{PRET_TYPE_LABEL[pret.type]}</div>
          <div className="mt-0.5 text-sm font-bold text-foreground">{pret.preteurNom}</div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${pret.statut === "REMBOURSE" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}
        >
          {pret.statut === "REMBOURSE" ? "Remboursé" : "En cours"}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>Remboursé : {formatFcfa(pret.montantRembourse)}</span>
        <span>Restant : {formatFcfa(pret.montantRestant)}</span>
      </div>
      {pret.dateEcheance && <div className="mt-2 text-[11px] text-muted-foreground">Échéance : {formatDate(pret.dateEcheance)}</div>}
      {pret.statut !== "REMBOURSE" && (
        <div className="mt-3 flex gap-1.5">
          <Input type="number" placeholder="Montant" value={montant} onChange={(e) => setMontant(e.target.value)} className="h-8 flex-1 text-xs" />
          <Button size="sm" variant="outline" disabled={busy} onClick={handleRembourser}>
            Rembourser
          </Button>
        </div>
      )}
      {erreur && <p className="mt-1 text-xs text-destructive">{erreur}</p>}
    </div>
  );
}

function NouveauPretForm({ onCreated }: { onCreated: () => void }) {
  const [type, setType] = useState<"BANCAIRE" | "PERSONNEL" | "PROPRIETAIRE">("BANCAIRE");
  const [preteurNom, setPreteurNom] = useState("");
  const [montant, setMontant] = useState("");
  const [dateObtention, setDateObtention] = useState(new Date().toISOString().slice(0, 10));
  const [dateEcheance, setDateEcheance] = useState("");
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function handleCreer() {
    setPending(true);
    setErreur(null);
    const res = await creerPret({ type, preteurNom, montant: Number(montant), dateObtention, dateEcheance: dateEcheance || null });
    setPending(false);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    onCreated();
  }

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="flex h-9 rounded-md border border-input bg-transparent px-2 text-sm">
          <option value="BANCAIRE">🏦 Prêt bancaire</option>
          <option value="PERSONNEL">🤝 Prêt personnel</option>
          <option value="PROPRIETAIRE">👤 Avance personnelle (propriétaire)</option>
        </select>
        <Input placeholder="Nom du prêteur" value={preteurNom} onChange={(e) => setPreteurNom(e.target.value)} />
        <Input type="number" placeholder="Montant" value={montant} onChange={(e) => setMontant(e.target.value)} />
        <Input type="date" value={dateObtention} onChange={(e) => setDateObtention(e.target.value)} />
        <Input type="date" placeholder="Échéance (optionnel)" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" disabled={pending} onClick={handleCreer}>
          Enregistrer
        </Button>
        {erreur && <span className="text-xs text-destructive">{erreur}</span>}
      </div>
    </div>
  );
}

// ---- Paramètres ----

function SeuilEditor({ seuil, isAdmin, onDone }: { seuil: number; isAdmin: boolean; onDone: () => void }) {
  const [valeur, setValeur] = useState(String(seuil));
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-sm font-semibold text-foreground">Seuil de validation hiérarchique</div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        En dessous de ce montant, un décaissement est auto-validé par son auteur. Au-delà, un autre utilisateur doit le valider avant qu&apos;il n&apos;impacte la caisse.
      </p>
      {!isAdmin ? (
        <p className="mt-3 text-sm">
          Seuil actuel : <b className="text-foreground">{formatFcfa(seuil)}</b>
        </p>
      ) : !editing ? (
        <p className="mt-3 text-sm">
          Seuil actuel : <b className="text-foreground">{formatFcfa(seuil)}</b>{" "}
          <button className="text-primary underline" onClick={() => setEditing(true)}>
            Modifier
          </button>
        </p>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <Input type="number" min="0" value={valeur} onChange={(e) => setValeur(e.target.value)} className="h-8 w-32" />
          <Button
            size="sm"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setErreur(null);
              const res = await definirSeuilDecaissement(Number(valeur));
              setPending(false);
              if (res.error) {
                setErreur(res.error);
                return;
              }
              setEditing(false);
              onDone();
            }}
          >
            Enregistrer
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
            Annuler
          </Button>
          {erreur && <span className="text-xs text-destructive">{erreur}</span>}
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">Réservé Admin / Super Admin.</p>
    </div>
  );
}
