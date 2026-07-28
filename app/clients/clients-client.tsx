"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { clients } from "@/db/schema";
import { createClient, type CreateClientState } from "./actions";

type Client = typeof clients.$inferSelect;

const initialState: CreateClientState = { error: null };

function TypeBadge({ type }: { type: string }) {
  return type === "ONG_CONTRAT" ? (
    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
      ONG / Contrat
    </span>
  ) : (
    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
      Boutique
    </span>
  );
}

export function ClientsClient({ clients: initialClients }: { clients: Client[] }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [type, setType] = useState<"BOUTIQUE" | "ONG_CONTRAT">("BOUTIQUE");
  const [search, setSearch] = useState("");
  const [state, action, pending] = useActionState(createClient, initialState);
  const [formKey, setFormKey] = useState(0);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setDrawerOpen(false);
      setFormKey((k) => k + 1);
      setType("BOUTIQUE");
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? initialClients.filter((c) => c.nom.toLowerCase().includes(q) || (c.contact ?? "").toLowerCase().includes(q))
    : initialClients;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Boutique (client comptant) ou ONG/Contrat (paiement différé, proforma en amont — §12).
          </p>
        </div>
        <Button onClick={() => setDrawerOpen(true)}>+ Nouveau client</Button>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher par nom ou contact..."
        className="mt-4 w-64"
      />

      <div className="mt-4 overflow-hidden rounded-md border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Contrat</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Aucun client.
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 font-medium text-foreground">{c.nom}</td>
                <td className="px-4 py-2.5">
                  <TypeBadge type={c.typeClient} />
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{c.contact ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {c.contratRef ? `${c.contratRef} (${c.paiementDiffereJours ?? 0} j.)` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
              <h2 className="text-lg font-semibold text-foreground">Nouveau client</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-xl leading-none text-muted-foreground"
                aria-label="Fermer"
              >
                &times;
              </button>
            </div>

            <form key={formKey} action={action} className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
                  Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: "BOUTIQUE" as const, label: "Boutique", desc: "Client comptant, paiement immédiat." },
                      { id: "ONG_CONTRAT" as const, label: "ONG / Contrat", desc: "Paiement différé, proforma en amont." },
                    ]
                  ).map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setType(t.id)}
                      className={`cursor-pointer rounded-md border p-2.5 text-xs ${
                        type === t.id ? "border-primary bg-primary/10" : "border-border bg-background"
                      }`}
                    >
                      <div className="font-semibold text-foreground">{t.label}</div>
                      <div className="mt-0.5 text-muted-foreground">{t.desc}</div>
                    </div>
                  ))}
                </div>
                <input type="hidden" name="typeClient" value={type} />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                  Nom
                </label>
                <Input name="nom" placeholder="Ex. Amadou Traoré / ONG Espoir" required />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                  Contact (téléphone/adresse)
                </label>
                <Input name="contact" placeholder="Ex. +223 70 00 00 00" />
              </div>

              {type === "ONG_CONTRAT" && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                      Référence contrat
                    </label>
                    <Input name="contratRef" placeholder="Ex. CT-2026-014" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                      Délai de paiement différé (jours)
                    </label>
                    <Input name="paiementDiffereJours" type="number" min="0" placeholder="Ex. 30" />
                  </div>
                </>
              )}

              {state.error && (
                <p className="text-sm text-destructive" role="alert">
                  {state.error}
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Création..." : "Créer le client"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
