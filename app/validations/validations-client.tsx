"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AppShell, type ShellModule } from "@/components/app-shell";
import {
  autoriserDemande,
  listerDemandesEnAttente,
  rechargerDemande,
  refuserDemande,
  refuserDemandeMaquette,
  refuserProforma,
  validerDemandeMaquette,
  validerProforma,
} from "./actions";

type Demande = Awaited<ReturnType<typeof listerDemandesEnAttente>>[number];
interface Proforma {
  id: number;
  numero: string;
  statut: string;
  montantTtc: string;
  clientNom: string;
  auteurNom: string;
  dateCreation: Date;
}
interface DemandeMaquetteDetails {
  depart: string | null;
  modelesChoisis: number[];
  imagesReferences?: string[];
  elements: { type: "logo" | "texte"; src?: string; content?: string }[];
  couleurType: string | null;
  couleurs: string[];
  explication: string;
  livraisonMode: string | null;
  impressionVoulue: boolean;
}
interface DemandeMaquette {
  id: number;
  numero: string;
  statut: string;
  nomClient: string;
  telephoneClient: string;
  intent: string;
  forfaitNom: string | null;
  forfaitPrix: string | null;
  dateCreation: Date;
  details: unknown;
}

const COULEUR_TYPE_LABEL: Record<string, string> = { choisir: "Palette proposée", libre: "Couleurs libres" };
const LIVRAISON_LABEL: Record<string, string> = { email: "Par email", whatsapp: "Par WhatsApp", telecharger: "À télécharger" };

function DemandeMaquetteDetail({ details }: { details: unknown }) {
  const d = details as DemandeMaquetteDetails | null;
  if (!d) return <p className="mt-2 text-xs text-muted-foreground">Aucun détail enregistré.</p>;
  const hasElements = d.elements?.length > 0;
  const hasImages = (d.imagesReferences?.length ?? 0) > 0;
  return (
    <div className="mt-2 rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs">
      {d.explication && (
        <p className="text-card-foreground">
          <span className="font-medium text-muted-foreground">Explication du client : </span>
          {d.explication}
        </p>
      )}
      {hasImages && (
        <div className="mt-2">
          <div className="font-medium text-muted-foreground">Images de référence envoyées :</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {d.imagesReferences!.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="h-14 w-14 rounded-md border border-border object-cover" />
            ))}
          </div>
        </div>
      )}
      {hasElements && (
        <div className="mt-2">
          <div className="font-medium text-muted-foreground">Logos / textes fournis :</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {d.elements.map((el, i) =>
              el.type === "logo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={el.src} alt="" className="h-14 w-14 rounded-md border border-border object-cover" />
              ) : (
                <span key={i} className="rounded-md border border-border bg-card px-2 py-1 text-card-foreground">
                  ✎ {el.content || "(texte vide)"}
                </span>
              )
            )}
          </div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        {d.couleurType && (
          <span>
            Couleurs : {COULEUR_TYPE_LABEL[d.couleurType] ?? d.couleurType}
            {d.couleurs?.length ? ` — ${d.couleurs.join(", ")}` : ""}
          </span>
        )}
        {d.livraisonMode && <span>Livraison : {LIVRAISON_LABEL[d.livraisonMode] ?? d.livraisonMode}</span>}
        {d.impressionVoulue && <span>Impression souhaitée</span>}
        {d.modelesChoisis?.length > 0 && <span>{d.modelesChoisis.length} modèle(s) de bibliothèque choisi(s)</span>}
      </div>
    </div>
  );
}

function formatFcfa(v: string | number) {
  return `${Math.round(Number(v)).toLocaleString("fr-FR")} F`;
}

const POLL_MS = 10_000;
const BIP_MS = 30_000;
const PAUSES = [1, 5, 15] as const;

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 250);
  } catch {
    // AudioContext indisponible (ex. avant toute interaction utilisateur) — silencieux.
  }
}

export function ValidationsClient({
  userName,
  roleLibelle,
  modules,
  demandes: initial,
  proformas,
  demandesMaquette,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  demandes: Demande[];
  proformas: Proforma[];
  demandesMaquette: DemandeMaquette[];
}) {
  const router = useRouter();
  const [enAttente, setEnAttente] = useState<Demande[]>(
    initial.filter((d) => d.statut === "EN_ATTENTE")
  );
  const historique = initial.filter((d) => d.statut !== "EN_ATTENTE").slice(0, 30);
  const proformasEnAttente = proformas.filter((p) => p.statut === "EN_ATTENTE");
  const proformasHistorique = proformas.filter((p) => p.statut !== "EN_ATTENTE").slice(0, 30);
  const maquetteEnAttente = demandesMaquette.filter((d) => d.statut === "EN_ATTENTE");
  const maquetteHistorique = demandesMaquette.filter((d) => d.statut !== "EN_ATTENTE").slice(0, 30);
  const [maquetteOuverte, setMaquetteOuverte] = useState<number | null>(null);

  const [alerteActive, setAlerteActive] = useState(false);
  const [pauseJusqua, setPauseJusqua] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rechargeSaisie, setRechargeSaisie] = useState<Record<number, string>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const stored = window.localStorage.getItem("evolutis223_alerte_stock");
    if (stored === "1") setAlerteActive(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("evolutis223_alerte_stock", alerteActive ? "1" : "0");
  }, [alerteActive]);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const fresh = await listerDemandesEnAttente();
        setEnAttente(fresh);
      } catch {
        // session expirée / accès refusé — la page se resynchronisera à la prochaine navigation
      }
    }, POLL_MS);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    if (!alerteActive || enAttente.length === 0) return;
    const enPause = pauseJusqua !== null && Date.now() < pauseJusqua;
    if (enPause) return;
    if (pauseJusqua !== null && Date.now() >= pauseJusqua) setPauseJusqua(null);

    beep();
    const timer = setInterval(() => {
      if (pauseJusqua === null || Date.now() >= pauseJusqua) beep();
    }, BIP_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerteActive, enAttente.length, pauseJusqua]);

  const refDemandes = useRef(enAttente);
  refDemandes.current = enAttente;

  async function refresh() {
    const fresh = await listerDemandesEnAttente();
    setEnAttente(fresh);
    router.refresh();
  }

  function traiter(action: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      setErreur(null);
      const res = await action();
      if (res.error) setErreur(res.error);
      await refresh();
    });
  }

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Tour de contrôle — Validations" modules={modules}>
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Validations stock (§9)</h1>
            <p className="text-sm text-muted-foreground">
              Ventes au détail bloquées par manque de réserve — décision Admin/Super Admin.
            </p>
          </div>
          <a href="/" className="text-sm text-muted-foreground hover:underline">
            ← Tableau de bord
          </a>
        </header>

        <section className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={alerteActive}
              onChange={(e) => {
                setAlerteActive(e.target.checked);
                setPauseJusqua(null);
              }}
            />
            Alerte sonore (bip toutes les 30s tant qu'une demande attend)
          </label>
          {alerteActive && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Mettre en pause :</span>
              {PAUSES.map((min) => (
                <button
                  key={min}
                  type="button"
                  className="rounded border border-border px-2 py-0.5 hover:bg-muted"
                  onClick={() => setPauseJusqua(Date.now() + min * 60_000)}
                >
                  {min} min
                </button>
              ))}
              {pauseJusqua && pauseJusqua > Date.now() && (
                <span>
                  (en pause jusqu'à {new Date(pauseJusqua).toLocaleTimeString("fr-FR")})
                </span>
              )}
            </div>
          )}
        </section>

        {erreur && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
            {erreur}
          </p>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            En attente ({enAttente.length})
          </h2>
          {enAttente.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>
          ) : (
            enAttente.map((d) => (
              <div key={d.id} className="rounded-md border border-border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-card-foreground">
                    {d.articleNom}
                    {d.taille || d.couleur
                      ? ` (${[d.taille, d.couleur].filter(Boolean).join(" / ")})`
                      : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Affaire {d.affaireNumero} · {d.canal}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  Demandé : {d.quantiteDemandee} — Manque : <strong>{d.manque}</strong>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() => traiter(() => autoriserDemande(d.id))}
                  >
                    Autoriser ({d.manque})
                  </Button>
                  <input
                    type="number"
                    min={d.manque}
                    placeholder={`≥ ${d.manque}`}
                    value={rechargeSaisie[d.id] ?? ""}
                    onChange={(e) =>
                      setRechargeSaisie((prev) => ({ ...prev, [d.id]: e.target.value }))
                    }
                    className="w-24 rounded border border-input bg-background px-2 py-1 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isPending}
                    onClick={() =>
                      traiter(() =>
                        rechargerDemande(d.id, Number(rechargeSaisie[d.id] ?? d.manque))
                      )
                    }
                  >
                    Recharger
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => traiter(() => refuserDemande(d.id))}
                  >
                    Refuser
                  </Button>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Proformas en attente (§12) — {proformasEnAttente.length}
          </h2>
          {proformasEnAttente.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune proforma en attente.</p>
          ) : (
            proformasEnAttente.map((p) => (
              <div key={p.id} className="rounded-md border border-border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-card-foreground">{p.numero}</span>
                  <span className="text-xs text-muted-foreground">par {p.auteurNom}</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {p.clientNom} — <strong>{formatFcfa(p.montantTtc)}</strong>
                </p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" disabled={isPending} onClick={() => traiter(() => validerProforma(p.id))}>
                    Valider
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => traiter(() => refuserProforma(p.id))}
                  >
                    Refuser
                  </Button>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Demandes maquette publiques (§10ter) — {maquetteEnAttente.length}
          </h2>
          {maquetteEnAttente.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>
          ) : (
            maquetteEnAttente.map((d) => (
              <div key={d.id} className="rounded-md border border-border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-card-foreground">{d.numero}</span>
                  <span className="text-xs text-muted-foreground">
                    {d.intent === "pagne" ? "Commander un pagne" : "Créer une maquette"}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {d.nomClient} — {d.telephoneClient}
                  {d.forfaitNom && (
                    <>
                      {" — "}
                      <strong>
                        {d.forfaitNom} ({formatFcfa(d.forfaitPrix ?? 0)})
                      </strong>
                    </>
                  )}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" disabled={isPending} onClick={() => traiter(() => validerDemandeMaquette(d.id))}>
                    Valider (crée l&apos;affaire)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => traiter(() => refuserDemandeMaquette(d.id))}
                  >
                    Refuser
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMaquetteOuverte(maquetteOuverte === d.id ? null : d.id)}
                  >
                    {maquetteOuverte === d.id ? "Masquer les détails" : "Voir les détails"}
                  </Button>
                </div>
                {maquetteOuverte === d.id && <DemandeMaquetteDetail details={d.details} />}
              </div>
            ))
          )}
        </section>

        {maquetteHistorique.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Demandes maquette traitées récemment</h2>
            <div className="space-y-1">
              {maquetteHistorique.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground"
                >
                  <span>
                    {d.numero} — {d.nomClient}
                  </span>
                  <span>{d.statut}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {proformasHistorique.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Proformas traitées récemment</h2>
            <div className="space-y-1">
              {proformasHistorique.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground"
                >
                  <span>
                    {p.numero} — {p.clientNom} — {formatFcfa(p.montantTtc)}
                  </span>
                  <span>{p.statut}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {historique.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Historique récent</h2>
            <div className="space-y-1">
              {historique.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground"
                >
                  <span>
                    {d.articleNom} — Affaire {d.affaireNumero} — manque {d.manque}
                  </span>
                  <span>{d.statut}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
    </AppShell>
  );
}
