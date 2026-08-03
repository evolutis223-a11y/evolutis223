"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell, type ShellModule } from "@/components/app-shell";
import { creerBonAchat } from "./actions";

type Fournisseur = { id: number; nom: string; contact: string | null; delaiLivraisonJours: number | null; actif: boolean };
type Lot = {
  id: number;
  reference: string | null;
  dateReception: Date | string;
  prixAchatUnitaire: number;
  articleNom: string;
  fournisseurNom: string | null;
  quantite: number;
};
type Bon = { id: number; montant: number; motif: string; dateCreation: Date | string; valide: boolean };

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("fr-FR");
}

export function AchatsClient({
  userName,
  roleLibelle,
  modules,
  fournisseurs,
  lots,
  bons: initialBons,
  totalAchatsMois,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  fournisseurs: Fournisseur[];
  lots: Lot[];
  bons: Bon[];
  totalAchatsMois: number;
}) {
  const [bons, setBons] = useState(initialBons);
  const [montant, setMontant] = useState("");
  const [motif, setMotif] = useState("");
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function handleCreer() {
    const m = Number(montant);
    if (!Number.isFinite(m) || m <= 0 || !motif.trim()) {
      setErreur("Montant et motif requis.");
      return;
    }
    setPending(true);
    setErreur(null);
    const fd = new FormData();
    fd.set("montant", montant);
    fd.set("motif", motif);
    const res = await creerBonAchat({ error: null }, fd);
    setPending(false);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    setBons((prev) => [{ id: Date.now(), montant: m, motif, dateCreation: new Date().toISOString(), valide: true }, ...prev]);
    setMontant("");
    setMotif("");
  }

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Achats" modules={modules}>
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold text-foreground">Achats (§7)</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Vue consolidée des approvisionnements (Stock) et des sorties de caisse Achat marchandise (Trésorerie) — pas de
        nouvelle logique, juste un écran dédié sur des données déjà réelles.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Fournisseurs actifs</div>
          <div className="text-lg font-bold text-foreground">{fournisseurs.filter((f) => f.actif).length}</div>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Lots réceptionnés</div>
          <div className="text-lg font-bold text-foreground">{lots.length}</div>
        </div>
        <div className="col-span-2 rounded-md border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Achats marchandise ce mois (validés)</div>
          <div className="text-lg font-bold text-primary">{fmt(totalAchatsMois)}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Fournisseurs</h2>
            <Link href="/fournisseurs" className="text-xs font-semibold text-primary hover:underline">Gérer →</Link>
          </div>
          <div className="flex flex-col gap-1.5">
            {fournisseurs.map((f) => (
              <div key={f.id} className={`rounded-md border border-border bg-card p-2.5 text-sm ${!f.actif ? "opacity-50" : ""}`}>
                <div className="font-semibold text-foreground">{f.nom}</div>
                <div className="text-xs text-muted-foreground">{f.contact ?? "—"} {f.delaiLivraisonJours ? `· délai ${f.delaiLivraisonJours}j` : ""}</div>
              </div>
            ))}
            {fournisseurs.length === 0 && <p className="text-sm text-muted-foreground">Aucun fournisseur enregistré.</p>}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Derniers lots réceptionnés</h2>
          <div className="flex flex-col gap-1.5">
            {lots.map((l) => (
              <div key={l.id} className="rounded-md border border-border bg-card p-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">{l.articleNom}</span>
                  <span className="text-muted-foreground">{fmtDate(l.dateReception)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {l.fournisseurNom ?? "Sans fournisseur"} · {l.quantite} pièces · PA {fmt(l.prixAchatUnitaire)}
                </div>
              </div>
            ))}
            {lots.length === 0 && <p className="text-sm text-muted-foreground">Aucun lot réceptionné.</p>}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Sorties de caisse — Achat marchandise</h2>
        <div className="flex flex-col gap-1.5">
          {bons.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-md border border-border bg-card p-2.5 text-sm">
              <div>
                <div className="text-foreground">{b.motif}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(b.dateCreation)}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{fmt(b.montant)}</span>
                {!b.valide && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">En attente</span>}
              </div>
            </div>
          ))}
          {bons.length === 0 && <p className="text-sm text-muted-foreground">Aucune sortie enregistrée.</p>}
        </div>

        <div className="mt-3 flex items-end gap-2 rounded-md border border-border bg-card p-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Motif</label>
            <Input placeholder="ex. Achat tissu — Fournisseur X" value={motif} onChange={(e) => setMotif(e.target.value)} />
          </div>
          <div className="w-32">
            <label className="mb-1 block text-xs text-muted-foreground">Montant (F)</label>
            <Input type="number" value={montant} onChange={(e) => setMontant(e.target.value)} />
          </div>
          <Button onClick={handleCreer} disabled={pending}>{pending ? "..." : "Enregistrer"}</Button>
        </div>
        {erreur && <p className="mt-1 text-xs text-destructive">{erreur}</p>}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Au-delà du seuil de validation hiérarchique (§16.7, réglable dans /tresorerie), un autre utilisateur devra valider
          avant que ce montant impacte la caisse.
        </p>
      </div>
    </div>
    </AppShell>
  );
}
