"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell, type ShellModule } from "@/components/app-shell";
import type { articles, variantes } from "@/db/schema";
import { LigneEditorRow } from "../affaires/affaires-client";
import type { LigneInput } from "../affaires/actions";
import { creerProforma } from "./actions";

type Article = typeof articles.$inferSelect;
type Variante = typeof variantes.$inferSelect;
interface ProformaRow {
  id: number;
  numero: string;
  statut: string;
  montantTtc: string;
  clientNom: string;
  dateCreation: Date;
}

function formatFcfa(v: string | number) {
  return `${Math.round(Number(v)).toLocaleString("fr-FR")} FCFA`;
}

const STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE: "En attente de validation",
  VALIDEE: "Validée — prête à envoyer",
  ANNULEE: "Refusée",
};

const STATUT_CLASS: Record<string, string> = {
  EN_ATTENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  VALIDEE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  ANNULEE: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

export function CommercialClient({
  userName,
  roleLibelle,
  modules,
  articles,
  variantes,
  proformas,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  articles: Article[];
  variantes: Variante[];
  proformas: ProformaRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientNom, setClientNom] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [lignes, setLignes] = useState<LigneInput[]>([
    { articleId: 0, varianteId: null, quantite: 1, prixUnitaire: 0 },
  ]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const total = lignes.reduce((acc, l) => acc + l.quantite * l.prixUnitaire, 0);

  function resetForm() {
    setClientNom("");
    setClientContact("");
    setLignes([{ articleId: 0, varianteId: null, quantite: 1, prixUnitaire: 0 }]);
    setErreur(null);
  }

  async function handleCreer() {
    setPending(true);
    setErreur(null);
    const res = await creerProforma(clientNom, clientContact, lignes);
    setPending(false);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    resetForm();
    setOpen(false);
    router.refresh();
  }

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Commercial" modules={modules}>
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Commercial — Proformas (§12)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Une proforma part en validation Admin/Super Admin avant de pouvoir être envoyée au
            client.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>+ Nouvelle proforma</Button>
      </div>

      <div className="mt-5 space-y-2">
        {proformas.length === 0 && (
          <p className="rounded-md border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Aucune proforma pour l&apos;instant.
          </p>
        )}
        {proformas.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
            <div>
              <div className="font-mono text-sm font-medium text-foreground">{p.numero}</div>
              <div className="text-xs text-muted-foreground">{p.clientNom}</div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold tabular-nums text-foreground">{formatFcfa(p.montantTtc)}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUT_CLASS[p.statut] ?? ""}`}>
                {STATUT_LABEL[p.statut] ?? p.statut}
              </span>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-30 flex justify-end bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="h-full w-full max-w-md overflow-y-auto bg-background p-6 shadow-xl">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-foreground">Nouvelle proforma</h2>
              <button onClick={() => setOpen(false)} className="text-xl leading-none text-muted-foreground" aria-label="Fermer">
                &times;
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                  Nom du client
                </label>
                <Input value={clientNom} onChange={(e) => setClientNom(e.target.value)} placeholder="Ex. Fatoumata Keïta" required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                  Contact (téléphone — optionnel, réutilisé s&apos;il existe déjà)
                </label>
                <Input value={clientContact} onChange={(e) => setClientContact(e.target.value)} placeholder="+223..." />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Lignes</label>
                <div className="space-y-2">
                  {lignes.map((l, i) => (
                    <LigneEditorRow
                      key={i}
                      articlesList={articles}
                      variantesList={variantes}
                      ligne={l}
                      onChange={(nl) => setLignes((prev) => prev.map((x, idx) => (idx === i ? nl : x)))}
                      onRemove={() => setLignes((prev) => prev.filter((_, idx) => idx !== i))}
                    />
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() =>
                    setLignes((prev) => [...prev, { articleId: 0, varianteId: null, quantite: 1, prixUnitaire: 0 }])
                  }
                >
                  + Ajouter une ligne
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                Total : <b className="text-foreground">{formatFcfa(total)}</b>
              </p>

              {erreur && (
                <p className="text-sm text-destructive" role="alert">
                  {erreur}
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
                <Button type="button" disabled={pending} onClick={handleCreer}>
                  {pending ? "Envoi..." : "Envoyer en validation"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </AppShell>
  );
}
