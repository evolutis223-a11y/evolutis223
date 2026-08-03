"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell, type ShellModule } from "@/components/app-shell";
import type { bonsDecaissement, cloturesCaisse, utilisateurs } from "@/db/schema";
import {
  cloturerCaisse,
  creerBonDecaissement,
  definirSeuilDecaissement,
  validerBonDecaissement,
  type BonState,
  type ClotureState,
} from "./actions";

type Bon = typeof bonsDecaissement.$inferSelect;
type Cloture = typeof cloturesCaisse.$inferSelect;
type Utilisateur = typeof utilisateurs.$inferSelect;

function formatFcfa(v: string | number) {
  return `${Math.round(Number(v)).toLocaleString("fr-FR")} F`;
}

const CATEGORIE_LABEL: Record<string, string> = {
  ACHAT_MARCHANDISE: "Achat marchandise",
  CHARGE_GENERAL: "Charge générale",
  RH_SALAIRE: "RH / Salaire",
};

const initialBonState: BonState = { error: null };
const initialClotureState: ClotureState = { error: null };

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
  const depasseSeuil = Number(bon.montant) > seuil;
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
      <td className="py-1.5">{CATEGORIE_LABEL[bon.categorie]}</td>
      <td className="py-1.5 tabular-nums">
        {formatFcfa(bon.montant)}
        {depasseSeuil && (
          <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            &gt; seuil
          </span>
        )}
      </td>
      <td className="py-1.5">{bon.motif}</td>
      <td className="py-1.5 text-xs text-muted-foreground">{auteurNom}</td>
      <td className="py-1.5">
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

function SeuilEditor({ seuil, isAdmin, onDone }: { seuil: number; isAdmin: boolean; onDone: () => void }) {
  const [valeur, setValeur] = useState(String(seuil));
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <p className="text-xs text-muted-foreground">
        Seuil de validation hiérarchique : <b className="text-foreground">{formatFcfa(seuil)}</b>
      </p>
    );
  }

  if (!editing) {
    return (
      <p className="text-xs text-muted-foreground">
        Seuil de validation hiérarchique : <b className="text-foreground">{formatFcfa(seuil)}</b>{" "}
        <button className="text-primary underline" onClick={() => setEditing(true)}>
          Modifier
        </button>
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min="0"
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        className="h-8 w-32"
      />
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
  );
}

function BonForm({ onCreated }: { onCreated: () => void }) {
  const [state, action, pending] = useActionState(creerBonDecaissement, initialBonState);
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
    <form key={formKey} action={action} className="flex flex-wrap items-end gap-2">
      <select name="categorie" className="flex h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm" required>
        <option value="ACHAT_MARCHANDISE">Achat marchandise</option>
        <option value="CHARGE_GENERAL">Charge générale</option>
        <option value="RH_SALAIRE">RH / Salaire</option>
      </select>
      <Input name="montant" type="number" min="1" placeholder="Montant" className="w-32" required />
      <Input name="motif" placeholder="Motif" className="w-48" required />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "..." : "Enregistrer le bon"}
      </Button>
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
    </form>
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
    <form action={action} className="space-y-3">
      <div className="text-sm text-muted-foreground">
        Solde théorique du jour (règlements espèces − décaissements) :{" "}
        <b className="text-foreground tabular-nums">{formatFcfa(soldeTheorique)}</b>
      </div>
      <div className="flex items-end gap-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
            Comptage réel
          </label>
          <Input
            name="comptageReel"
            type="number"
            min="0"
            value={comptage}
            onChange={(e) => setComptage(e.target.value)}
            className="w-32"
            required
          />
        </div>
        {comptage && Math.abs(ecart) > 0.01 && (
          <div className="text-sm">
            <span className="text-muted-foreground">Écart : </span>
            <span className={ecart < 0 ? "font-semibold text-destructive" : "font-semibold text-emerald-700"}>
              {ecart > 0 ? "+" : ""}
              {formatFcfa(ecart)}
            </span>
          </div>
        )}
      </div>
      {comptage && Math.abs(ecart) > 0.01 && (
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
            Justification (requise en cas d&apos;écart)
          </label>
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

export function TresorerieClient({
  userName,
  roleLibelle,
  modules,
  bons,
  clotures,
  utilisateurs,
  soldeTheoriqueAujourdhui,
  clotureAujourdhuiExiste,
  seuilValidation,
  currentUserId,
  isAdmin,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  bons: Bon[];
  clotures: Cloture[];
  utilisateurs: Utilisateur[];
  soldeTheoriqueAujourdhui: number;
  clotureAujourdhuiExiste: boolean;
  seuilValidation: number;
  currentUserId: number;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const nomAuteur = (id: number) => utilisateurs.find((u) => u.id === id)?.nom ?? "—";

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Trésorerie" modules={modules}>
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Trésorerie</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bons de décaissement et clôture de caisse — tout part des affaires et mouvements
          réellement enregistrés, rien saisi à la main (§5).
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Bons de décaissement</h2>
        <BonForm onCreated={() => router.refresh()} />
        <div className="mt-2">
          <SeuilEditor seuil={seuilValidation} isAdmin={isAdmin} onDone={() => router.refresh()} />
        </div>
        <div className="mt-3 overflow-hidden rounded-md border border-border">
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
            <tbody className="px-3">
              {bons.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Aucun bon.
                  </td>
                </tr>
              )}
              {bons.map((b) => (
                <BonRow
                  key={b.id}
                  bon={b}
                  auteurNom={nomAuteur(b.auteurId)}
                  seuil={seuilValidation}
                  currentUserId={currentUserId}
                  onValidated={() => router.refresh()}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Clôture de caisse</h2>
        {clotureAujourdhuiExiste ? (
          <p className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            La caisse d&apos;aujourd&apos;hui est déjà clôturée.
          </p>
        ) : (
          <ClotureForm soldeTheorique={soldeTheoriqueAujourdhui} onDone={() => router.refresh()} />
        )}

        <div className="mt-4 overflow-hidden rounded-md border border-border">
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
      </section>
    </div>
    </AppShell>
  );
}
