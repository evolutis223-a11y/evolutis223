"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  autoriserDemande,
  listerDemandesEnAttente,
  rechargerDemande,
  refuserDemande,
  refuserProforma,
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
  demandes: initial,
  proformas,
}: {
  demandes: Demande[];
  proformas: Proforma[];
}) {
  const router = useRouter();
  const [enAttente, setEnAttente] = useState<Demande[]>(
    initial.filter((d) => d.statut === "EN_ATTENTE")
  );
  const historique = initial.filter((d) => d.statut !== "EN_ATTENTE").slice(0, 30);
  const proformasEnAttente = proformas.filter((p) => p.statut === "EN_ATTENTE");
  const proformasHistorique = proformas.filter((p) => p.statut !== "EN_ATTENTE").slice(0, 30);

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
    <main className="min-h-screen p-6">
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
    </main>
  );
}
