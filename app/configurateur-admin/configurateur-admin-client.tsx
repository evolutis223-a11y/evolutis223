"use client";

import { useRef, useState } from "react";
import { AppShell, type ShellModule } from "@/components/app-shell";
import { AideBulle } from "@/components/ui/aide-bulle";
import {
  ajouterFinition,
  ajouterModeleConfigurateur,
  definirZonesModele,
  retirerFinition,
  retirerModeleConfigurateur,
} from "../configurateur/actions";

type Zone = { id: string; label: string; technique: string; xPct?: number; yPct?: number; largeurCm?: number; hauteurCm?: number };
type Modele = { id: number; nom: string; articleId: number; photoUrl: string; prixDepart: number; zones: Zone[] };
type Finition = { id: number; nom: string; montant: number };
type ArticleOpt = { id: number; nom: string; code: string };

const TECHNIQUES = [
  { value: "SERIGRAPHIE", label: "Sérigraphie" },
  { value: "DTF", label: "DTF" },
  { value: "SUBLIMATION", label: "Sublimation" },
  { value: "FLOCAGE", label: "Flocage" },
  { value: "BRODERIE", label: "Broderie" },
];
let zoneIdCounter = 1;

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

export function ConfigurateurAdminClient({
  userName,
  roleLibelle,
  modules,
  modeles: initialModeles,
  finitions: initialFinitions,
  articles,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  modeles: Modele[];
  finitions: Finition[];
  articles: ArticleOpt[];
}) {
  const [tab, setTab] = useState<"modeles" | "finitions">("modeles");
  const [modeles, setModeles] = useState(initialModeles);
  const [finitions, setFinitions] = useState(initialFinitions);

  const [uploading, setUploading] = useState(false);
  const [erreurModele, setErreurModele] = useState<string | null>(null);
  const [nomModele, setNomModele] = useState("");
  const [articleId, setArticleId] = useState("");
  const [prixDepart, setPrixDepart] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [nomFinition, setNomFinition] = useState("");
  const [montantFinition, setMontantFinition] = useState("");
  const [erreurFinition, setErreurFinition] = useState<string | null>(null);

  const [zonesModeleId, setZonesModeleId] = useState<number | null>(null);
  const [zonesEdit, setZonesEdit] = useState<Zone[]>([]);
  const [positionActiveId, setPositionActiveId] = useState<string | null>(null);
  const [nouvelleZoneLabel, setNouvelleZoneLabel] = useState("");
  const [nouvelleZoneTechnique, setNouvelleZoneTechnique] = useState("DTF");
  const [erreurZones, setErreurZones] = useState<string | null>(null);
  const [savingZones, setSavingZones] = useState(false);

  function openZonesEditor(m: Modele) {
    setZonesModeleId(m.id);
    setZonesEdit(m.zones.map((z) => ({ ...z })));
    setPositionActiveId(m.zones[0]?.id ?? null);
    setErreurZones(null);
  }

  function placerZone(id: string, xPct: number, yPct: number) {
    setZonesEdit((zs) => zs.map((z) => (z.id === id ? { ...z, xPct: Math.round(xPct * 10) / 10, yPct: Math.round(yPct * 10) / 10 } : z)));
  }

  function addZoneEdit() {
    if (!nouvelleZoneLabel.trim()) return;
    const id = `z-new-${zoneIdCounter++}`;
    setZonesEdit((z) => [...z, { id, label: nouvelleZoneLabel.trim(), technique: nouvelleZoneTechnique, largeurCm: 10, hauteurCm: 10 }]);
    setPositionActiveId(id);
    setNouvelleZoneLabel("");
  }

  function removeZoneEdit(id: string) {
    setZonesEdit((z) => z.filter((x) => x.id !== id));
  }

  async function saveZonesEdit() {
    if (zonesModeleId === null) return;
    if (zonesEdit.length === 0) {
      setErreurZones("Au moins une zone est requise.");
      return;
    }
    if (zonesEdit.some((z) => z.xPct == null)) {
      setErreurZones("Chaque zone doit être positionnée sur la photo avant d'enregistrer.");
      return;
    }
    setSavingZones(true);
    setErreurZones(null);
    try {
      await definirZonesModele(zonesModeleId, zonesEdit);
      setModeles((ms) => ms.map((m) => (m.id === zonesModeleId ? { ...m, zones: zonesEdit } : m)));
      setZonesModeleId(null);
    } catch (err) {
      setErreurZones(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setSavingZones(false);
    }
  }

  async function handleAddModele(file: File | null) {
    if (!file || !nomModele.trim() || !articleId || !prixDepart) {
      setErreurModele("Nom, article, prix et photo requis.");
      return;
    }
    setUploading(true);
    setErreurModele(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("nom", nomModele.trim());
    fd.set("articleId", articleId);
    fd.set("prixDepart", prixDepart);
    const res = await ajouterModeleConfigurateur({ error: null }, fd);
    setUploading(false);
    if (res.error) {
      setErreurModele(res.error);
      return;
    }
    setModeles((m) => [
      ...m,
      { id: Date.now(), nom: nomModele.trim(), articleId: Number(articleId), photoUrl: res.url!, prixDepart: Number(prixDepart), zones: [{ id: "z1", label: "Logo poitrine", technique: "DTF", xPct: 50, yPct: 30, largeurCm: 10, hauteurCm: 10 }] },
    ]);
    setNomModele("");
    setArticleId("");
    setPrixDepart("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleRemoveModele(id: number) {
    setModeles((m) => m.filter((x) => x.id !== id));
    await retirerModeleConfigurateur(id);
  }

  async function handleAddFinition() {
    const montant = Number(montantFinition);
    if (!nomFinition.trim() || !Number.isFinite(montant) || montant < 0) {
      setErreurFinition("Nom et montant valides requis.");
      return;
    }
    const fd = new FormData();
    fd.set("nom", nomFinition.trim());
    fd.set("montant", montantFinition);
    const res = await ajouterFinition({ error: null }, fd);
    if (res.error) {
      setErreurFinition(res.error);
      return;
    }
    setFinitions((f) => [...f, { id: Date.now(), nom: nomFinition.trim(), montant }]);
    setNomFinition("");
    setMontantFinition("");
    setErreurFinition(null);
  }

  async function handleRemoveFinition(id: number) {
    setFinitions((f) => f.filter((x) => x.id !== id));
    await retirerFinition(id);
  }

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Configurateur — Paramètres" modules={modules}>
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-foreground">Paramètres — Configurateur (§3.3/§10)</h1>
        <AideBulle titre="Comment utiliser Configurateur — Paramètres">
          <p>
            Alimente ce que le client public voit sur /configurateur, sans jamais y apparaître soi-même côté public.
          </p>
          <p>
            <b>Modèles (chemin court)</b> — les gabarits prêts à choisir avec un prix de départ. <b>Finitions (chemin long)</b> — les options de personnalisation détaillée proposées au client.
          </p>
        </AideBulle>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Galerie de modèles chemin court et finitions du chemin long — invisible du côté client public.
      </p>

      <div className="mt-5 flex gap-1.5 border-b border-border">
        {(["modeles", "finitions"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-md border border-b-0 px-4 py-2 text-sm font-semibold ${tab === t ? "border-border bg-muted text-foreground" : "border-transparent text-muted-foreground"}`}
          >
            {t === "modeles" ? "Modèles (chemin court)" : "Finitions (chemin long)"}
          </button>
        ))}
      </div>

      <div className="rounded-b-md border border-border bg-muted/30 p-5">
        {tab === "modeles" && (
          <div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {modeles.map((m) => (
                <div key={m.id} className="relative">
                  <div className="aspect-[4/5] overflow-hidden rounded-md border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.photoUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                  <button
                    onClick={() => handleRemoveModele(m.id)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-background bg-destructive text-xs text-destructive-foreground"
                  >
                    ×
                  </button>
                  <div className="mt-1 text-center text-[10px] text-muted-foreground">{m.nom} — {fmt(m.prixDepart)}</div>
                  <button
                    onClick={() => openZonesEditor(m)}
                    className="mt-1 w-full rounded-md border border-border bg-card py-1 text-[10px] font-semibold text-primary"
                  >
                    {m.zones.length} zone{m.zones.length > 1 ? "s" : ""} — Éditer
                  </button>
                </div>
              ))}
              {modeles.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Aucun modèle pour l&apos;instant.</p>}
            </div>
            <div className="mt-4 flex flex-col gap-2 rounded-md border border-border bg-card p-3">
              <input value={nomModele} onChange={(e) => setNomModele(e.target.value)} placeholder="Nom du modèle" className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
              <select value={articleId} onChange={(e) => setArticleId(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                <option value="">Article support...</option>
                {articles.map((a) => (
                  <option key={a.id} value={a.id}>{a.nom} ({a.code})</option>
                ))}
              </select>
              <input value={prixDepart} onChange={(e) => setPrixDepart(e.target.value)} type="number" placeholder="Prix de départ (F)" className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
              <input ref={fileRef} type="file" accept="image/*" className="text-sm" onChange={(e) => handleAddModele(e.target.files?.[0] ?? null)} />
              {uploading && <span className="text-xs text-muted-foreground">Envoi...</span>}
              {erreurModele && <p className="text-xs text-destructive">{erreurModele}</p>}
            </div>
          </div>
        )}

        {tab === "finitions" && (
          <div>
            <div className="flex flex-col gap-2">
              {finitions.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-md border border-border bg-card p-3">
                  <span className="text-sm text-foreground">{f.nom}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-primary">+{fmt(f.montant)}</span>
                    <button onClick={() => handleRemoveFinition(f.id)} className="text-xs text-destructive">Retirer</button>
                  </div>
                </div>
              ))}
              {finitions.length === 0 && <p className="text-sm text-muted-foreground">Aucune finition.</p>}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-card p-3">
              <input value={nomFinition} onChange={(e) => setNomFinition(e.target.value)} placeholder="Nom de la finition" className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm" />
              <input value={montantFinition} onChange={(e) => setMontantFinition(e.target.value)} type="number" placeholder="Montant (F)" className="h-9 w-32 rounded-md border border-input bg-background px-2 text-sm" />
              <button onClick={handleAddFinition} className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Ajouter</button>
            </div>
            {erreurFinition && <p className="mt-1 text-xs text-destructive">{erreurFinition}</p>}
          </div>
        )}
      </div>
    </div>

    {zonesModeleId !== null && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onClick={(e) => e.target === e.currentTarget && setZonesModeleId(null)}
      >
        <div className="w-[min(480px,92vw)] rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-sm font-bold uppercase text-foreground">Zones de logo — {modeles.find((m) => m.id === zonesModeleId)?.nom}</h2>
            <button onClick={() => setZonesModeleId(null)} className="text-lg text-muted-foreground">&times;</button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Chaque zone correspond à un emplacement de logo proposé au client sur le chemin court (ex. « Logo poitrine », « Logo manche »).
            Sélectionnez une zone ci-dessous puis cliquez sur la photo pour la positionner — la position est figée dès que vous enregistrez.
          </p>

          <div
            onClick={(e) => {
              if (!positionActiveId) return;
              const rect = e.currentTarget.getBoundingClientRect();
              placerZone(positionActiveId, ((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100);
            }}
            className="relative mt-3 h-56 cursor-crosshair overflow-hidden rounded-md border border-border bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={modeles.find((m) => m.id === zonesModeleId)?.photoUrl} alt="" className="h-full w-full object-cover" />
            {!positionActiveId && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 px-6 text-center text-xs text-white">
                Sélectionnez une zone ci-dessous pour la positionner
              </div>
            )}
            {zonesEdit.map((z, i) =>
              z.xPct == null ? null : (
                <button
                  key={z.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPositionActiveId(z.id);
                  }}
                  style={{ left: `${z.xPct}%`, top: `${z.yPct}%` }}
                  className={`absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-primary-foreground shadow ${
                    z.id === positionActiveId ? "bg-amber-500" : "bg-primary"
                  }`}
                >
                  {i + 1}
                </button>
              )
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {zonesEdit.map((z, i) => (
              <div
                key={z.id}
                onClick={() => setPositionActiveId(z.id)}
                className={`flex items-center gap-2 rounded-md border p-2 ${z.id === positionActiveId ? "border-primary bg-primary/5" : "border-border bg-background"}`}
              >
                <span className="text-[11px] font-bold text-muted-foreground">{i + 1}</span>
                <input
                  value={z.label}
                  onChange={(e) => setZonesEdit((zs) => zs.map((x) => (x.id === z.id ? { ...x, label: e.target.value } : x)))}
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 flex-1 rounded-md border border-input bg-card px-2 text-sm"
                />
                <select
                  value={z.technique}
                  onChange={(e) => setZonesEdit((zs) => zs.map((x) => (x.id === z.id ? { ...x, technique: e.target.value } : x)))}
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 rounded-md border border-input bg-card px-1 text-xs"
                >
                  {TECHNIQUES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={z.largeurCm ?? 10}
                  onChange={(e) => setZonesEdit((zs) => zs.map((x) => (x.id === z.id ? { ...x, largeurCm: Number(e.target.value) } : x)))}
                  onClick={(e) => e.stopPropagation()}
                  title="Largeur (cm)"
                  className="h-8 w-14 rounded-md border border-input bg-card px-1 text-xs"
                />
                <input
                  type="number"
                  value={z.hauteurCm ?? 10}
                  onChange={(e) => setZonesEdit((zs) => zs.map((x) => (x.id === z.id ? { ...x, hauteurCm: Number(e.target.value) } : x)))}
                  onClick={(e) => e.stopPropagation()}
                  title="Hauteur (cm)"
                  className="h-8 w-14 rounded-md border border-input bg-card px-1 text-xs"
                />
                {z.xPct == null && <span className="text-[10px] text-amber-600">non placée</span>}
                <button onClick={(e) => { e.stopPropagation(); removeZoneEdit(z.id); }} className="text-xs text-destructive">Retirer</button>
              </div>
            ))}
            {zonesEdit.length === 0 && <p className="text-sm text-muted-foreground">Aucune zone — le client ne pourra pas envoyer de logo.</p>}
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-border p-2">
            <input
              value={nouvelleZoneLabel}
              onChange={(e) => setNouvelleZoneLabel(e.target.value)}
              placeholder="Nouvelle zone (ex. Logo manche)"
              className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm"
            />
            <select value={nouvelleZoneTechnique} onChange={(e) => setNouvelleZoneTechnique(e.target.value)} className="h-8 rounded-md border border-input bg-background px-1 text-xs">
              {TECHNIQUES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <button onClick={addZoneEdit} className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">+ Ajouter</button>
          </div>
          {erreurZones && <p className="mt-2 text-xs text-destructive">{erreurZones}</p>}
          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <button onClick={() => setZonesModeleId(null)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground">Annuler</button>
            <button onClick={saveZonesEdit} disabled={savingZones} className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
              {savingZones ? "..." : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    )}
    </AppShell>
  );
}
