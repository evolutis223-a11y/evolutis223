"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignerPilote, avancerOf } from "./actions";

interface OfRow {
  id: number;
  affaireId: number;
  affaireNumero: string;
  clientNom: string;
  articleNom: string;
  quantite: number;
  etape: string;
  personnalise: boolean;
  piloteId: number | null;
  piloteNom: string | null;
  dateCreation: Date;
}
interface Pilote {
  id: number;
  nom: string;
  roleCode: string;
}

const ETAPES = [
  { id: "RECEPTION", label: "Réception", dot: "bg-slate-400", bar: "border-slate-400" },
  { id: "CONCEPTION", label: "Conception", dot: "bg-blue-500", bar: "border-blue-500" },
  { id: "PRODUCTION", label: "Production", dot: "bg-amber-500", bar: "border-amber-500" },
  { id: "CONTROLE_QUALITE", label: "Contrôle qualité", dot: "bg-violet-500", bar: "border-violet-500" },
  { id: "PRET", label: "Prêt", dot: "bg-emerald-500", bar: "border-emerald-500" },
] as const;

function sequencePour(personnalise: boolean): string[] {
  return personnalise
    ? ["RECEPTION", "CONCEPTION", "PRODUCTION", "CONTROLE_QUALITE", "PRET"]
    : ["RECEPTION", "PRODUCTION", "CONTROLE_QUALITE", "PRET"];
}

function etapeMeta(id: string) {
  return ETAPES.find((e) => e.id === id)!;
}

function initials(nom: string) {
  return nom
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ProductionClient({ ofs: initial, pilotes }: { ofs: OfRow[]; pilotes: Pilote[] }) {
  const router = useRouter();
  const [ofs, setOfs] = useState(initial);
  const [detail, setDetail] = useState<OfRow | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverEtape, setDragOverEtape] = useState<string | null>(null);
  const [filterPilote, setFilterPilote] = useState<number | "TOUS">("TOUS");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);

  const visible = ofs.filter((o) => {
    if (onlyUnassigned) return !o.piloteId;
    if (filterPilote !== "TOUS") return o.piloteId === filterPilote;
    return true;
  });

  async function move(of_: OfRow, nextEtape: string) {
    const sequence = sequencePour(of_.personnalise);
    if (sequence.indexOf(nextEtape) !== sequence.indexOf(of_.etape) + 1) return;
    setErreur(null);
    const res = await avancerOf(of_.id, nextEtape);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    setOfs((prev) => prev.map((o) => (o.id === of_.id ? { ...o, etape: nextEtape } : o)));
    if (detail?.id === of_.id) setDetail({ ...of_, etape: nextEtape });
    router.refresh();
  }

  async function pilote(of_: OfRow, piloteId: number | null) {
    const res = await assignerPilote(of_.id, piloteId);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    const piloteNom = piloteId ? pilotes.find((p) => p.id === piloteId)?.nom ?? null : null;
    setOfs((prev) => prev.map((o) => (o.id === of_.id ? { ...o, piloteId, piloteNom } : o)));
    if (detail?.id === of_.id) setDetail({ ...of_, piloteId, piloteNom });
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Ordres de fabrication — Kanban</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Créé automatiquement à la validation d&apos;une affaire (§8.1 — Famille D, ou Kit marqué
            « nécessite assemblage »). Réception → Conception (si personnalisé) → Production →
            Contrôle qualité → Prêt. Le Retrait/Livraison est ensuite géré dans Commandes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterPilote}
            onChange={(e) => setFilterPilote(e.target.value === "TOUS" ? "TOUS" : Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="TOUS">Tous les pilotes</option>
            {pilotes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
          <button
            onClick={() => setOnlyUnassigned((v) => !v)}
            className={`h-9 rounded-md border px-3 text-sm ${
              onlyUnassigned
                ? "border-transparent bg-amber-100 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                : "border-border bg-background text-muted-foreground"
            }`}
          >
            Non assignés uniquement
          </button>
        </div>
      </div>

      {erreur && <p className="mt-3 text-sm text-destructive">{erreur}</p>}

      <div className="mt-5 grid grid-cols-5 gap-3 text-sm">
        {ETAPES.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${e.dot}`} />
              {e.label}
            </span>
            <span className="font-mono text-base font-semibold text-foreground">
              {ofs.filter((o) => o.etape === e.id).length}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="grid grid-cols-5 gap-3" style={{ minWidth: 1000 }}>
          {ETAPES.map((e) => {
            const items = visible.filter((o) => o.etape === e.id);
            return (
              <div
                key={e.id}
                onDragOver={(ev) => {
                  ev.preventDefault();
                  setDragOverEtape(e.id);
                }}
                onDragLeave={() => setDragOverEtape(null)}
                onDrop={(ev) => {
                  ev.preventDefault();
                  setDragOverEtape(null);
                  const of_ = ofs.find((o) => o.id === draggedId);
                  if (of_) move(of_, e.id);
                }}
                className={`min-h-[140px] rounded-xl bg-muted/50 p-2.5 ${
                  dragOverEtape === e.id ? "outline outline-2 outline-dashed outline-ring" : ""
                }`}
              >
                <div className="mb-2 flex items-center justify-between px-1 pt-1">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span className={`h-2 w-2 rounded-full ${e.dot}`} />
                    {e.label}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 && (
                    <p className="p-3 text-center text-xs text-muted-foreground">Aucun OF</p>
                  )}
                  {items.map((o) => (
                    <div
                      key={o.id}
                      draggable
                      onDragStart={() => setDraggedId(o.id)}
                      onDragEnd={() => setDraggedId(null)}
                      onClick={() => setDetail(o)}
                      className={`cursor-grab rounded-lg border-l-[3px] border border-border bg-card p-3 text-sm shadow-sm hover:-translate-y-px ${etapeMeta(o.etape).bar}`}
                    >
                      <div className="font-mono text-[11px] text-muted-foreground">OF-{o.id}</div>
                      <div className="mt-0.5 text-[13px] font-semibold leading-tight text-card-foreground">
                        {o.articleNom}
                      </div>
                      <div className="mt-1 flex items-baseline justify-between gap-2 font-mono text-[11px] text-muted-foreground">
                        <span>{o.affaireNumero}</span>
                        <span>×{o.quantite}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{o.clientNom}</div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        {!o.personnalise && (
                          <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            Standard
                          </span>
                        )}
                        {o.piloteId && o.piloteNom ? (
                          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                              {initials(o.piloteNom)}
                            </span>
                            {o.piloteNom.split(" ")[0]}
                          </span>
                        ) : (
                          <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Non assigné
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {detail && (
        <div
          className="fixed inset-0 z-30 flex justify-end bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetail(null);
          }}
        >
          <div className="h-full w-full max-w-md overflow-y-auto bg-background p-6 shadow-xl">
            <div className="flex items-baseline justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{detail.articleNom}</h2>
                <div className="font-mono text-xs text-muted-foreground">
                  OF-{detail.id} — Affaire {detail.affaireNumero}
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="text-xl leading-none text-muted-foreground" aria-label="Fermer">
                &times;
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Client</div>
                <div className="mt-1">{detail.clientNom}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Quantité</div>
                <div className="mt-1 font-mono">{detail.quantite}</div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Étape</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {sequencePour(detail.personnalise).map((id) => (
                    <button
                      key={id}
                      onClick={() => move(detail, id)}
                      className={`rounded-md border px-2.5 py-1.5 text-xs ${
                        id === detail.etape
                          ? "border-transparent bg-primary font-semibold text-primary-foreground"
                          : "border-border bg-background text-foreground"
                      }`}
                    >
                      {etapeMeta(id).label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Pilote assigné</div>
                <select
                  value={detail.piloteId ?? ""}
                  onChange={(e) => pilote(detail, e.target.value ? Number(e.target.value) : null)}
                  className="mt-2 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">— Non assigné —</option>
                  {pilotes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
                {detail.personnalise
                  ? "Personnalisé — passe par Conception."
                  : "Standard — sans étape Conception, va directement en Production."}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
