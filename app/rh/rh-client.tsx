"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ajouterPersonnel,
  basculerActifPersonnel,
  calculerCommissionSuggeree,
  genererBulletin,
  marquerBulletinPaye,
} from "./actions";

type Personnel = {
  id: number;
  nom: string;
  telephone: string | null;
  fonction: string | null;
  typeContrat: string;
  utilisateurId: number | null;
  salaireBase: number;
  tauxCommission: number | null;
  actif: boolean;
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

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} F`;
}
function moisCourant() {
  return new Date().toISOString().slice(0, 7);
}
const TYPE_LABELS: Record<string, string> = { SALARIE: "Salarié", JOURNALIER: "Journalier", PARTENAIRE: "Partenaire" };

export function RhClient({
  personnel: initialPersonnel,
  bulletins: initialBulletins,
  utilisateurs,
}: {
  personnel: Personnel[];
  bulletins: Bulletin[];
  utilisateurs: UtilisateurOpt[];
}) {
  const [tab, setTab] = useState<"personnel" | "paie">("personnel");
  const [personnel, setPersonnel] = useState(initialPersonnel);
  const [bulletins, setBulletins] = useState(initialBulletins);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold text-foreground">RH (§7)</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Registre du personnel (salariés, journaliers, partenaires) et bulletins de paie — les commissions se calculent sur les
        affaires dont la personne est l&apos;auteur.
      </p>

      <div className="mt-5 flex gap-1.5 border-b border-border">
        {(["personnel", "paie"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-md border border-b-0 px-4 py-2 text-sm font-semibold ${tab === t ? "border-border bg-muted text-foreground" : "border-transparent text-muted-foreground"}`}
          >
            {t === "personnel" ? "Personnel" : "Paie"}
          </button>
        ))}
      </div>

      <div className="rounded-b-md border border-border bg-muted/30 p-5">
        {tab === "personnel" && (
          <PersonnelTab personnel={personnel} setPersonnel={setPersonnel} utilisateurs={utilisateurs} />
        )}
        {tab === "paie" && (
          <PaieTab personnel={personnel} bulletins={bulletins} setBulletins={setBulletins} />
        )}
      </div>
    </main>
  );
}

function PersonnelTab({
  personnel,
  setPersonnel,
  utilisateurs,
}: {
  personnel: Personnel[];
  setPersonnel: (fn: (p: Personnel[]) => Personnel[]) => void;
  utilisateurs: UtilisateurOpt[];
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [fonction, setFonction] = useState("");
  const [typeContrat, setTypeContrat] = useState("SALARIE");
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
    fd.set("fonction", fonction);
    fd.set("typeContrat", typeContrat);
    fd.set("salaireBase", salaireBase || "0");
    fd.set("tauxCommission", tauxCommission);
    fd.set("utilisateurId", utilisateurId);
    const res = await ajouterPersonnel({ error: null }, fd);
    setPending(false);
    if (res.error || !res.personnelId) {
      setErreur(res.error ?? "Erreur.");
      return;
    }
    setPersonnel((p) => [
      ...p,
      {
        id: res.personnelId!,
        nom,
        telephone: telephone || null,
        fonction: fonction || null,
        typeContrat,
        utilisateurId: utilisateurId ? Number(utilisateurId) : null,
        salaireBase: Number(salaireBase || 0),
        tauxCommission: tauxCommission ? Number(tauxCommission) : null,
        actif: true,
      },
    ]);
    setNom("");
    setTelephone("");
    setFonction("");
    setSalaireBase("");
    setTauxCommission("");
    setUtilisateurId("");
  }

  async function handleToggle(id: number, actif: boolean) {
    setPersonnel((p) => p.map((x) => (x.id === id ? { ...x, actif } : x)));
    await basculerActifPersonnel(id, actif);
  }

  return (
    <div>
      <div className="flex flex-col gap-2">
        {personnel.map((p) => (
          <div key={p.id} className={`flex items-center justify-between rounded-md border border-border bg-card p-3 ${!p.actif ? "opacity-50" : ""}`}>
            <div>
              <div className="text-sm font-semibold text-foreground">{p.nom} <span className="ml-1 text-xs font-normal text-muted-foreground">({TYPE_LABELS[p.typeContrat]})</span></div>
              <div className="text-xs text-muted-foreground">
                {p.fonction ?? "—"} · {p.telephone ?? "—"} · Salaire de base {fmt(p.salaireBase)}
                {p.tauxCommission ? ` · Commission ${p.tauxCommission}%` : ""}
              </div>
            </div>
            <button onClick={() => handleToggle(p.id, !p.actif)} className="text-xs text-muted-foreground hover:text-foreground">
              {p.actif ? "Désactiver" : "Réactiver"}
            </button>
          </div>
        ))}
        {personnel.length === 0 && <p className="text-sm text-muted-foreground">Aucun personnel enregistré.</p>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-md border border-border bg-card p-3">
        <Input placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} />
        <Input placeholder="Téléphone" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
        <Input placeholder="Fonction" value={fonction} onChange={(e) => setFonction(e.target.value)} />
        <select value={typeContrat} onChange={(e) => setTypeContrat(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="SALARIE">Salarié</option>
          <option value="JOURNALIER">Journalier</option>
          <option value="PARTENAIRE">Partenaire</option>
        </select>
        <Input type="number" placeholder="Salaire de base (F)" value={salaireBase} onChange={(e) => setSalaireBase(e.target.value)} />
        <Input type="number" placeholder="Taux commission % (optionnel)" value={tauxCommission} onChange={(e) => setTauxCommission(e.target.value)} />
        <select value={utilisateurId} onChange={(e) => setUtilisateurId(e.target.value)} className="col-span-2 h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Compte applicatif lié (optionnel — requis pour la commission)</option>
          {utilisateurs.map((u) => (
            <option key={u.id} value={u.id}>{u.nom}</option>
          ))}
        </select>
        <Button onClick={handleAdd} disabled={pending || !nom.trim()} className="col-span-2">
          {pending ? "Ajout..." : "Ajouter au personnel"}
        </Button>
        {erreur && <p className="col-span-2 text-xs text-destructive">{erreur}</p>}
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
  const [personnelId, setPersonnelId] = useState("");
  const [periode, setPeriode] = useState(moisCourant());
  const [salaireBase, setSalaireBase] = useState(0);
  const [primeTransport, setPrimeTransport] = useState(0);
  const [commission, setCommission] = useState(0);
  const [retenueInps, setRetenueInps] = useState(0);
  const [avance, setAvance] = useState(0);
  const [suggesting, setSuggesting] = useState(false);
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const p = personnel.find((x) => x.id === Number(personnelId));
  const netAPayer = salaireBase + primeTransport + commission - retenueInps - avance;

  function selectPersonnel(id: string) {
    setPersonnelId(id);
    const found = personnel.find((x) => x.id === Number(id));
    setSalaireBase(found?.salaireBase ?? 0);
    setCommission(0);
    setPrimeTransport(0);
    setRetenueInps(0);
    setAvance(0);
  }

  async function handleSuggererCommission() {
    if (!p) return;
    setSuggesting(true);
    const val = await calculerCommissionSuggeree(p.id, periode);
    setCommission(Math.round(val));
    setSuggesting(false);
  }

  async function handleGenerer() {
    if (!p) return;
    setPending(true);
    setErreur(null);
    const res = await genererBulletin({
      personnelId: p.id,
      periode,
      salaireBase,
      primeTransport,
      commission,
      retenueInps,
      avance,
    });
    setPending(false);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    setBulletins((prev) => {
      const existing = prev.find((b) => b.id === res.bulletinId);
      const nouveau: Bulletin = {
        id: res.bulletinId!,
        personnelId: p.id,
        personnelNom: p.nom,
        periode,
        salaireBase,
        primeTransport,
        commission,
        retenueInps,
        avance,
        netAPayer,
        statut: "BROUILLON",
      };
      if (existing) return prev.map((b) => (b.id === res.bulletinId ? nouveau : b));
      return [nouveau, ...prev];
    });
  }

  async function handleMarquerPaye(id: number) {
    setErreur(null);
    const res = await marquerBulletinPaye(id);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    setBulletins((prev) => prev.map((b) => (b.id === id ? { ...b, statut: "PAYE" } : b)));
  }

  return (
    <div>
      <div className="rounded-md border border-border bg-card p-4">
        <div className="grid grid-cols-2 gap-2">
          <select value={personnelId} onChange={(e) => selectPersonnel(e.target.value)} className="col-span-2 h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Choisir un personnel...</option>
            {personnel.filter((x) => x.actif).map((x) => (
              <option key={x.id} value={x.id}>{x.nom} ({TYPE_LABELS[x.typeContrat]})</option>
            ))}
          </select>
          <Input type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} className="col-span-2" />
        </div>

        {p && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Salaire de base</label>
                <Input type="number" value={salaireBase} onChange={(e) => setSalaireBase(Number(e.target.value))} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Prime transport</label>
                <Input type="number" value={primeTransport} onChange={(e) => setPrimeTransport(Number(e.target.value))} />
              </div>
              <div>
                <label className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  Commission
                  {p.tauxCommission != null && p.utilisateurId != null && (
                    <button onClick={handleSuggererCommission} disabled={suggesting} className="text-primary">
                      {suggesting ? "..." : `Suggérer (${p.tauxCommission}%)`}
                    </button>
                  )}
                </label>
                <Input type="number" value={commission} onChange={(e) => setCommission(Number(e.target.value))} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Retenue INPS</label>
                <Input type="number" value={retenueInps} onChange={(e) => setRetenueInps(Number(e.target.value))} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Avance déjà versée</label>
                <Input type="number" value={avance} onChange={(e) => setAvance(Number(e.target.value))} />
              </div>
              <div className="flex flex-col justify-end">
                <div className="text-xs text-muted-foreground">Net à payer</div>
                <div className="text-lg font-bold text-foreground">{fmt(netAPayer)}</div>
              </div>
            </div>
            {erreur && <p className="mt-2 text-xs text-destructive">{erreur}</p>}
            <Button onClick={handleGenerer} disabled={pending} className="mt-3 w-full">
              {pending ? "Génération..." : "Générer / mettre à jour le bulletin"}
            </Button>
          </>
        )}
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Bulletins récents</h3>
        <div className="flex flex-col gap-2">
          {bulletins.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-md border border-border bg-card p-3">
              <div>
                <div className="text-sm text-foreground">{b.personnelNom} — {b.periode}</div>
                <div className="text-xs text-muted-foreground">Net à payer : {fmt(b.netAPayer)}</div>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={`/api/documents/fiche-paie/${b.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
                >
                  PDF
                </a>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${b.statut === "PAYE" ? "bg-green-700/20 text-green-700" : "bg-muted text-muted-foreground"}`}>
                  {b.statut}
                </span>
                {b.statut === "BROUILLON" && (
                  <button onClick={() => handleMarquerPaye(b.id)} className="text-xs font-semibold text-primary">
                    Marquer payé
                  </button>
                )}
              </div>
            </div>
          ))}
          {bulletins.length === 0 && <p className="text-sm text-muted-foreground">Aucun bulletin pour l&apos;instant.</p>}
        </div>
      </div>
    </div>
  );
}
