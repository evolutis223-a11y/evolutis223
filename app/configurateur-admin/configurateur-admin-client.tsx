"use client";

import { useRef, useState } from "react";
import { AppShell, type ShellModule } from "@/components/app-shell";
import {
  ajouterFinition,
  ajouterModeleConfigurateur,
  definirZonesModele,
  retirerFinition,
  retirerModeleConfigurateur,
} from "../configurateur/actions";

type Zone = { id: string; label: string; technique: string };
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
  const [nouvelleZoneLabel, setNouvelleZoneLabel] = useState("");
  const [nouvelleZoneTechnique, setNouvelleZoneTechnique] = useState("DTF");
  const [erreurZones, setErreurZones] = useState<string | null>(null);
  const [savingZones, setSavingZones] = useState(false);

  function openZonesEditor(m: Modele) {
    setZonesModeleId(m.id);
    setZonesEdit(m.zones.map((z) => ({ ...z })));
    setErreurZones(null);
  }

  function addZoneEdit() {
    if (!nouvelleZoneLabel.trim()) return;
    setZonesEdit((z) => [...z, { id: `z-new-${zoneIdCounter++}`, label: nouvelleZoneLabel.trim(), technique: nouvelleZoneTechnique }]);
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
      { id: Date.now(), nom: nomModele.trim(), articleId: Number(articleId), photoUrl: res.url!, prixDepart: Number(prixDepart), zones: [{ id: "z1", label: "Logo poitrine", technique: "DTF" }] },
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
      <h1 className="text-xl font-semibold text-foreground">Paramètres — Configurateur (§3.3/§10)</h1>
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
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {zonesEdit.map((z) => (
              <div key={z.id} className="flex items-center gap-2 rounded-md border border-border bg-background p-2">
                <input
                  value={z.label}
                  onChange={(e) => setZonesEdit((zs) => zs.map((x) => (x.id === z.id ? { ...x, label: e.target.value } : x)))}
                  className="h-8 flex-1 rounded-md border border-input bg-card px-2 text-sm"
                />
                <select
                  value={z.technique}
                  onChange={(e) => setZonesEdit((zs) => zs.map((x) => (x.id === z.id ? { ...x, technique: e.target.value } : x)))}
                  className="h-8 rounded-md border border-input bg-card px-1 text-xs"
                >
                  {TECHNIQUES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <button onClick={() => removeZoneEdit(z.id)} className="text-xs text-destructive">Retirer</button>
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
