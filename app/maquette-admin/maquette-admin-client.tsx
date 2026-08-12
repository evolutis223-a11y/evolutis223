"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AppShell, type ShellModule } from "@/components/app-shell";
import { AideBulle } from "@/components/ui/aide-bulle";
import { ajouterModele, basculerVerrouillage, definirParametresParcours, retirerModele } from "../maquette/actions";

type Donnees = {
  modeles: { id: number; blobUrl: string; tag: string | null }[];
  dispositions: Record<number, { positions: [number, number][]; verrouille: boolean }>;
  badgeForme: string;
  badgeTaille: number;
};

export function MaquetteAdminClient({
  userName,
  roleLibelle,
  modules,
  donnees: initial,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  donnees: Donnees;
}) {
  const [tab, setTab] = useState<"bibliotheque" | "logos" | "guide">("bibliotheque");
  const [donnees, setDonnees] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleAddModele(file: File | null, tag: string) {
    if (!file) return;
    setUploading(true);
    setErreur(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("tag", tag);
    const res = await ajouterModele({ error: null }, fd);
    setUploading(false);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    setDonnees((d) => ({ ...d, modeles: [...d.modeles, { id: Date.now(), blobUrl: res.url!, tag }] }));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleRemove(id: number) {
    setDonnees((d) => ({ ...d, modeles: d.modeles.filter((m) => m.id !== id) }));
    await retirerModele(id);
  }

  async function handleToggleLock(n: number, val: boolean) {
    setDonnees((d) => ({ ...d, dispositions: { ...d.dispositions, [n]: { ...d.dispositions[n], verrouille: val } } }));
    await basculerVerrouillage(n, val);
  }

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Maquette — Paramètres" modules={modules}>
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-foreground">Paramètres — Parcours maquette (§10ter)</h1>
        <AideBulle titre="Comment utiliser Maquette — Paramètres">
          <p>
            Alimente ce que le client public voit sur /maquette, sans jamais y apparaître soi-même côté public.
          </p>
          <p>
            <b>Bibliothèque</b> — les visuels d&apos;exemple proposés au client. <b>Disposition des logos</b> — où et comment un logo client peut être placé sur le produit. <b>Guide technique</b> — les consignes de fichier à respecter (format, résolution...).
          </p>
        </AideBulle>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Bibliothèque de modèles, disposition des logos, guide technique — invisible du côté client public.
      </p>

      <div className="mt-5 flex gap-1.5 border-b border-border">
        {(["bibliotheque", "logos", "guide"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-md border border-b-0 px-4 py-2 text-sm font-semibold ${tab === t ? "border-border bg-muted text-foreground" : "border-transparent text-muted-foreground"}`}
          >
            {t === "bibliotheque" ? "Bibliothèque" : t === "logos" ? "Disposition des logos" : "Guide technique"}
          </button>
        ))}
      </div>

      <div className="rounded-b-md border border-border bg-muted/30 p-5">
        {tab === "bibliotheque" && (
          <div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {donnees.modeles.map((m) => (
                <div key={m.id} className="relative">
                  <div className="aspect-[3/4] overflow-hidden rounded-md border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.blobUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                  <button
                    onClick={() => handleRemove(m.id)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-background bg-destructive text-xs text-destructive-foreground"
                  >
                    ×
                  </button>
                  <div className="mt-1 text-center text-[10px] text-muted-foreground">{m.tag ?? "—"}</div>
                </div>
              ))}
              {donnees.modeles.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground">Aucun modèle pour l&apos;instant.</p>
              )}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="text-sm" onChange={(e) => handleAddModele(e.target.files?.[0] ?? null, "chaud")} />
              {uploading && <span className="text-xs text-muted-foreground">Envoi...</span>}
            </div>
            {erreur && <p className="mt-1 text-xs text-destructive">{erreur}</p>}
          </div>
        )}

        {tab === "logos" && (
          <div className="space-y-4">
            {[3, 4, 6].map((n) => (
              <div key={n} className="flex items-center justify-between rounded-md border border-border bg-card p-3">
                <div className="text-sm font-semibold text-foreground">{n} logos</div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={donnees.dispositions[n]?.verrouille ?? false}
                    onChange={(e) => handleToggleLock(n, e.target.checked)}
                  />
                  Figer — le client ne pourra plus glisser
                </label>
              </div>
            ))}
            <BadgeConfigForm badgeForme={donnees.badgeForme} badgeTaille={donnees.badgeTaille} />
            <p className="text-xs text-muted-foreground">
              Repositionner les points de repère (glisser-déposer) sera ajouté ici — pour l&apos;instant, figer/libérer et la forme/taille
              des médaillons suffisent.
            </p>
          </div>
        )}

        {tab === "guide" && (
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-semibold text-foreground">Vignettes de la bibliothèque</h3>
              <p className="text-muted-foreground">JPEG ou WebP, ratio 3:4 (portrait), 900×1200px, sRGB, moins de 500 Ko.</p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Motif de référence (la &quot;taille à graver&quot;)</h3>
              <p className="text-muted-foreground">
                Toujours au ratio réel 64×110cm quelle que soit la résolution — c&apos;est ce ratio qui compte pour que la disposition
                s&apos;aligne correctement sur le tissu.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Fichiers de production (forfaits Pro/Premium)</h3>
              <p className="text-muted-foreground">Vectoriel (AI/EPS) ou PDF/TIFF 300dpi aux dimensions réelles — le fichier &quot;prêt à graver&quot;.</p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Couleurs</h3>
              <p className="text-muted-foreground">
                Le sélecteur client capture une intention, pas une spécification technique — la correspondance avec les encres/teintures se
                fait ensuite avec le designer.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
    </AppShell>
  );
}

function BadgeConfigForm({ badgeForme, badgeTaille }: { badgeForme: string; badgeTaille: number }) {
  const [forme, setForme] = useState(badgeForme);
  const [taille, setTaille] = useState(badgeTaille);
  const [saved, setSaved] = useState(false);
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 text-sm font-semibold text-foreground">Forme et taille des médaillons</div>
      <div className="flex items-center gap-3">
        <select value={forme} onChange={(e) => setForme(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="circle">Cercle</option>
          <option value="rect">Rectangle</option>
        </select>
        <input
          type="range"
          min="0.6"
          max="1.6"
          step="0.1"
          value={taille}
          onChange={(e) => setTaille(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-12 text-right text-sm">{Math.round(taille * 100)}%</span>
        <Button
          size="sm"
          onClick={async () => {
            await definirParametresParcours(forme, taille);
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          }}
        >
          {saved ? "Enregistré ✓" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
