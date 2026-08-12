"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell, type ShellModule } from "@/components/app-shell";
import { AideBulle } from "@/components/ui/aide-bulle";
import type { articles, variantes } from "@/db/schema";
import { LigneEditorRow } from "../affaires/affaires-client";
import type { LigneInput } from "../affaires/actions";
import { creerProforma, type DonneesCommerciales } from "./actions";

type Article = typeof articles.$inferSelect;
type Variante = typeof variantes.$inferSelect;

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

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-xl font-bold tabular-nums text-foreground">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function LienParrainage({ code }: { code: string }) {
  const [copie, setCopie] = useState(false);
  const lien = `https://evolutis223.com/nos-produits?ref=${code}`;

  async function copier() {
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // presse-papiers indisponible — pas bloquant, le lien reste sélectionnable à la main
    }
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="text-sm font-semibold text-foreground">Mon lien de parrainage</div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Partage-le pour montrer &laquo; Nos produits &raquo; sans que la personne ait besoin d&apos;un compte — chaque visite via ce lien est comptabilisée.
        L&apos;attribution automatique des ventes/commissions arrivera avec le futur système de commande.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground">{lien}</code>
        <Button size="sm" variant="outline" onClick={copier}>
          {copie ? "Copié !" : "Copier"}
        </Button>
      </div>
    </div>
  );
}

export function CommercialClient({
  userName,
  roleLibelle,
  modules,
  articles,
  variantes,
  isRespCommercial,
  moi,
  equipe,
  proformas,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  articles: Article[];
  variantes: Variante[];
  isRespCommercial: boolean;
} & DonneesCommerciales) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientNom, setClientNom] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [lignes, setLignes] = useState<LigneInput[]>([{ articleId: 0, varianteId: null, quantite: 1, prixUnitaire: 0 }]);
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
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">Commercial</h1>
              <AideBulle titre="Comment utiliser Commercial">
                <p>
                  <b>Proformas</b> — un devis que tu soumets pour un client ; il part en validation Admin/Super Admin avant d&apos;être envoyé. Exemple : un client
                  te demande un prix pour 50 polos, tu crées la proforma, l&apos;admin valide, tu peux ensuite l&apos;envoyer.
                </p>
                <p>
                  <b>Mon activité</b> — tes ventes (affaires dont tu es l&apos;auteur) et la commission calculée dessus, si un taux t&apos;a été attribué en RH.
                </p>
                <p>
                  <b>Lien de parrainage</b> — un lien unique à toi ; une vente faite via ce lien depuis la boutique en ligne (à venir) te sera automatiquement
                  créditée.
                </p>
                {isRespCommercial && (
                  <p>
                    <b>Mon équipe</b> — visible uniquement pour Resp. Commercial : ventes et commission suggérée de chaque Freelance/Commercial ce mois-ci.
                  </p>
                )}
              </AideBulle>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Mon activité, mes commissions, mon lien de parrainage, et mes proformas.</p>
          </div>
          <Button onClick={() => setOpen(true)}>+ Nouvelle proforma</Button>
        </div>

        <div>
          <div className="mb-2 text-sm font-semibold text-foreground">Mon activité ce mois-ci</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Mes ventes" value={formatFcfa(moi.ventesMois)} hint={`${moi.nombreVentesMois} affaire(s)`} />
            <Stat label="Ma commission (suggérée)" value={formatFcfa(moi.commissionSuggereeMois)} hint={moi.tauxCommission != null ? `Taux : ${moi.tauxCommission}%` : "Aucun taux défini"} />
            <Stat label="Commission déjà payée" value={formatFcfa(moi.commissionPayeeTotal)} />
            <Stat label="Commission en attente" value={formatFcfa(moi.commissionEnAttente)} />
          </div>
          {!moi.aUnPersonnelLie && (
            <p className="mt-2 text-xs text-muted-foreground">
              Aucune fiche RH n&apos;est encore liée à ton compte — demande à un Admin de te rattacher un dossier personnel avec un taux de commission pour que ce calcul s&apos;active.
            </p>
          )}
        </div>

        <LienParrainage code={moi.lienCode} />

        {isRespCommercial && equipe.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-semibold text-foreground">Mon équipe — ce mois-ci</div>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2">Nom</th>
                    <th className="px-3 py-2">Rôle</th>
                    <th className="px-3 py-2 text-right">Ventes</th>
                    <th className="px-3 py-2 text-right">Commission suggérée</th>
                  </tr>
                </thead>
                <tbody>
                  {equipe.map((m) => (
                    <tr key={m.utilisateurId} className="border-t border-border">
                      <td className="px-3 py-1.5">{m.nom}</td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">{m.roleLibelle}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {formatFcfa(m.ventesMois)} <span className="text-muted-foreground">({m.nombreVentesMois})</span>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{formatFcfa(m.commissionSuggereeMois)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 text-sm font-semibold text-foreground">Mes proformas</div>
          <div className="space-y-2">
            {proformas.length === 0 && (
              <p className="rounded-md border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">Aucune proforma pour l&apos;instant.</p>
            )}
            {proformas.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
                <div>
                  <div className="font-mono text-sm font-medium text-foreground">{p.numero}</div>
                  <div className="text-xs text-muted-foreground">{p.clientNom}</div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-semibold tabular-nums text-foreground">{formatFcfa(p.montantTtc)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUT_CLASS[p.statut] ?? ""}`}>{STATUT_LABEL[p.statut] ?? p.statut}</span>
                </div>
              </div>
            ))}
          </div>
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
                  <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Nom du client</label>
                  <Input value={clientNom} onChange={(e) => setClientNom(e.target.value)} placeholder="Ex. Fatoumata Keïta" required />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Contact (téléphone — optionnel, réutilisé s&apos;il existe déjà)</label>
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
                    onClick={() => setLignes((prev) => [...prev, { articleId: 0, varianteId: null, quantite: 1, prixUnitaire: 0 }])}
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
