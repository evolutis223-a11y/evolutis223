"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell, type ShellModule } from "@/components/app-shell";
import { creerFraisNumerique, basculerStatutFrais, supprimerFraisNumerique, type FraisNumeriqueState } from "./actions";

type Ligne = {
  id: number;
  libelle: string;
  categorie: string;
  devise: string;
  montant: number;
  montantUsd: number;
  montantFcfa: number;
  frequence: string;
  statut: string;
  notes: string | null;
  dateCreation: Date | string;
};

const CATEGORIES: Record<string, string> = {
  DOMAINE: "Nom de domaine",
  HEBERGEMENT: "Hébergement",
  OUTILS_IA: "Outils / IA",
  PAIEMENT_LIGNE: "Paiement en ligne",
  BOUTIQUE: "Boutique en ligne",
  AUTRE: "Autre",
};

const FREQUENCES: Record<string, string> = {
  UNIQUE: "Unique",
  MENSUEL: "Mensuel",
  ANNUEL: "Annuel",
};

function fmtFcfa(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}
function fmtUsd(n: number) {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("fr-FR");
}

export function FraisNumeriquesClient({
  userName,
  roleLibelle,
  modules,
  lignes: initialLignes,
  totalMensuelFcfa,
  totalUniqueFcfa,
  tauxXofParUsd,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  lignes: Ligne[];
  totalMensuelFcfa: number;
  totalUniqueFcfa: number;
  tauxXofParUsd: number;
}) {
  const [lignes, setLignes] = useState(initialLignes);
  const [libelle, setLibelle] = useState("");
  const [categorie, setCategorie] = useState("AUTRE");
  const [devise, setDevise] = useState("USD");
  const [montant, setMontant] = useState("");
  const [frequence, setFrequence] = useState("MENSUEL");
  const [statut, setStatut] = useState("PREVU");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function handleCreer() {
    const m = Number(montant);
    if (!libelle.trim() || !Number.isFinite(m) || m <= 0) {
      setErreur("Libellé et montant requis.");
      return;
    }
    setPending(true);
    setErreur(null);
    const fd = new FormData();
    fd.set("libelle", libelle);
    fd.set("categorie", categorie);
    fd.set("devise", devise);
    fd.set("montant", montant);
    fd.set("frequence", frequence);
    fd.set("statut", statut);
    fd.set("notes", notes);
    const res: FraisNumeriqueState = await creerFraisNumerique({ error: null }, fd);
    setPending(false);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    const montantUsd = devise === "USD" ? m : m / tauxXofParUsd;
    const montantFcfa = devise === "USD" ? m * tauxXofParUsd : m;
    setLignes((prev) => [
      { id: Date.now(), libelle, categorie, devise, montant: m, montantUsd, montantFcfa, frequence, statut, notes: notes || null, dateCreation: new Date().toISOString() },
      ...prev,
    ]);
    setLibelle("");
    setMontant("");
    setNotes("");
  }

  async function handleBasculer(id: number) {
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, statut: l.statut === "ACTIF" ? "PREVU" : "ACTIF" } : l)));
    await basculerStatutFrais(id);
  }

  async function handleSupprimer(id: number) {
    setLignes((prev) => prev.filter((l) => l.id !== id));
    await supprimerFraisNumerique(id);
  }

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Frais numériques" modules={modules}>
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold text-foreground">Frais numériques — registre des coûts de mise en ligne</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Domaine, hébergement, outils/IA, paiement en ligne... Coûts payés par carte personnelle, séparés de la
        comptabilité de caisse (/depenses). Taux indicatif : 1 $ ≈ {tauxXofParUsd} F.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-md border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Récurrent actif (par mois, annuel ramené au mois)</div>
          <div className="text-2xl font-bold text-primary">{fmtFcfa(totalMensuelFcfa)}</div>
          <div className="text-xs text-muted-foreground">≈ {fmtUsd(totalMensuelFcfa / tauxXofParUsd)}</div>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Frais uniques actifs (cumulés)</div>
          <div className="text-2xl font-bold text-foreground">{fmtFcfa(totalUniqueFcfa)}</div>
          <div className="text-xs text-muted-foreground">≈ {fmtUsd(totalUniqueFcfa / tauxXofParUsd)}</div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-1.5">
        {lignes.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-md border border-border bg-card p-2.5 text-sm">
            <div>
              <div className="text-foreground">{l.libelle}</div>
              <div className="text-xs text-muted-foreground">
                {CATEGORIES[l.categorie]} · {FREQUENCES[l.frequence]} · {fmtDate(l.dateCreation)}
                {l.notes ? ` · ${l.notes}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="font-semibold text-foreground">
                  {l.devise === "USD" ? fmtUsd(l.montant) : fmtFcfa(l.montant)}
                </div>
                <div className="text-xs text-muted-foreground">
                  ≈ {l.devise === "USD" ? fmtFcfa(l.montantFcfa) : fmtUsd(l.montantUsd)}
                </div>
              </div>
              <button
                onClick={() => handleBasculer(l.id)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  l.statut === "ACTIF" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {l.statut === "ACTIF" ? "Actif" : "Prévu"}
              </button>
              <button onClick={() => handleSupprimer(l.id)} className="text-xs text-destructive hover:underline">
                Suppr.
              </button>
            </div>
          </div>
        ))}
        {lignes.length === 0 && <p className="text-sm text-muted-foreground">Aucun frais enregistré.</p>}
      </div>

      <div className="mt-4 rounded-md border border-border bg-card p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="mb-1 block text-xs text-muted-foreground">Libellé</label>
            <Input placeholder="ex. Abonnement Claude" value={libelle} onChange={(e) => setLibelle(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Catégorie</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm"
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
            >
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Fréquence</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm"
              value={frequence}
              onChange={(e) => setFrequence(e.target.value)}
            >
              {Object.entries(FREQUENCES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Devise</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm"
              value={devise}
              onChange={(e) => setDevise(e.target.value)}
            >
              <option value="USD">USD ($)</option>
              <option value="FCFA">FCFA</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Montant</label>
            <Input type="number" value={montant} onChange={(e) => setMontant(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Statut</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm"
              value={statut}
              onChange={(e) => setStatut(e.target.value)}
            >
              <option value="PREVU">Prévu (pas encore payé)</option>
              <option value="ACTIF">Actif (déjà payé/en cours)</option>
            </select>
          </div>
          <div className="col-span-2 sm:col-span-3">
            <label className="mb-1 block text-xs text-muted-foreground">Notes (optionnel)</label>
            <Input placeholder="ex. evolutis223.com, pas encore acheté" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <Button className="mt-3" onClick={handleCreer} disabled={pending}>
          {pending ? "..." : "Ajouter"}
        </Button>
        {erreur && <p className="mt-1 text-xs text-destructive">{erreur}</p>}
      </div>
    </div>
    </AppShell>
  );
}
