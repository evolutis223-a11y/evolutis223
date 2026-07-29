"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { fournisseurs } from "@/db/schema";
import { createFournisseur, toggleFournisseurActif, type CreateFournisseurState } from "./actions";

type Fournisseur = typeof fournisseurs.$inferSelect;

const initialState: CreateFournisseurState = { error: null };

function CreateFournisseurForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState(createFournisseur, initialState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) onDone();
    wasPending.current = pending;
  }, [pending, state.error, onDone]);

  return (
    <form action={action} className="mt-5 space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Nom</label>
        <Input name="nom" placeholder="Ex. COMATEX SA" required />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Contact</label>
        <Input name="contact" placeholder="Téléphone, email... (optionnel)" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
          Délai de livraison habituel (jours)
        </label>
        <Input name="delaiLivraisonJours" type="number" min="0" placeholder="Ex. 7 (optionnel)" />
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Création..." : "Créer le fournisseur"}
        </Button>
      </div>
    </form>
  );
}

export function FournisseursClient({
  fournisseurs: initialFournisseurs,
  nbLotsParFournisseur,
}: {
  fournisseurs: Fournisseur[];
  nbLotsParFournisseur: Record<number, number>;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Fournisseurs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saisie manuelle (contact, délais) — sélectionnable à l&apos;approvisionnement dans Stocks (§7).
          </p>
        </div>
        <Button onClick={() => setDrawerOpen(true)}>+ Nouveau fournisseur</Button>
      </div>

      <div className="mt-5 space-y-2">
        {initialFournisseurs.length === 0 && (
          <p className="rounded-md border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Aucun fournisseur pour l&apos;instant.
          </p>
        )}
        {initialFournisseurs.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
            <div>
              <div className="font-medium text-foreground">{f.nom}</div>
              <div className="text-xs text-muted-foreground">
                {f.contact || "Pas de contact renseigné"}
                {f.delaiLivraisonJours !== null && ` — délai habituel ${f.delaiLivraisonJours}j`}
                {" — "}
                {nbLotsParFournisseur[f.id] ?? 0} lot(s) approvisionné(s)
              </div>
            </div>
            <button
              onClick={() => toggleFournisseurActif(f.id, !f.actif)}
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: f.actif ? "#10b98122" : "var(--border)",
                color: f.actif ? "#10b981" : "var(--muted-foreground)",
              }}
            >
              {f.actif ? "Actif" : "Inactif"}
            </button>
          </div>
        ))}
      </div>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 flex justify-end bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          <div className="h-full w-full max-w-md overflow-y-auto bg-background p-6 shadow-xl">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-foreground">Nouveau fournisseur</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-xl leading-none text-muted-foreground"
                aria-label="Fermer"
              >
                &times;
              </button>
            </div>
            <CreateFournisseurForm onDone={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </main>
  );
}
