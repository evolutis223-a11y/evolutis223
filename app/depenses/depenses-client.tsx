"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell, type ShellModule } from "@/components/app-shell";
import { creerDepense } from "./actions";

type Bon = { id: number; montant: number; motif: string; dateCreation: Date | string; valide: boolean };

const MOTIFS_RAPIDES = ["Loyer", "Courant / électricité", "Transport", "Imprévu"];

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} F`;
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("fr-FR");
}

export function DepensesClient({
  userName,
  roleLibelle,
  modules,
  bons: initialBons,
  totalMois,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  bons: Bon[];
  totalMois: number;
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
    const res = await creerDepense({ error: null }, fd);
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
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Dépenses" modules={modules}>
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold text-foreground">Dépenses &amp; Charges (§7)</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Loyer, courant, transport, imprévus — mêmes sorties de caisse que /tresorerie (catégorie Charge générale),
        regroupées ici pour un suivi dédié. « Dépenses » et « Charges » pointent sur le même écran (voir CAHIER_DES_CHARGES.md
        §7 pour la justification).
      </p>

      <div className="mt-4 rounded-md border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">Total dépenses/charges ce mois (validées)</div>
        <div className="text-2xl font-bold text-primary">{fmt(totalMois)}</div>
      </div>

      <div className="mt-5">
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
          {bons.length === 0 && <p className="text-sm text-muted-foreground">Aucune dépense enregistrée.</p>}
        </div>

        <div className="mt-3 rounded-md border border-border bg-card p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {MOTIFS_RAPIDES.map((m) => (
              <button
                key={m}
                onClick={() => setMotif(m)}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Motif</label>
              <Input placeholder="ex. Loyer août" value={motif} onChange={(e) => setMotif(e.target.value)} />
            </div>
            <div className="w-32">
              <label className="mb-1 block text-xs text-muted-foreground">Montant (F)</label>
              <Input type="number" value={montant} onChange={(e) => setMontant(e.target.value)} />
            </div>
            <Button onClick={handleCreer} disabled={pending}>{pending ? "..." : "Enregistrer"}</Button>
          </div>
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
