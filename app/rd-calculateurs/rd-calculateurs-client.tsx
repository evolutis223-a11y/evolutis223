"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell, type ShellModule } from "@/components/app-shell";
import { AideBulle } from "@/components/ui/aide-bulle";
import type { articles, clients } from "@/db/schema";
import {
  ajouterCadre,
  ajouterEncre,
  ajouterPalierBroderie,
  ajouterSupport,
  creerAffaireAvecMarquage,
  creerAffaireDepuisModele,
  definirParametresMarquage,
  modifierPrixReference,
  modifierQteReferenceMlEncre,
  modifierSurfaceReferenceEncre,
  retirerReference,
  type LigneBase,
  type ModelePret,
} from "./actions";
import {
  calculerTotal,
  type Bibliotheque,
  type ChargeAdditionnelle,
  type Technique,
  type ZoneConfig,
} from "@/lib/calculateurs/marquage";

type Article = typeof articles.$inferSelect;
type Client = typeof clients.$inferSelect;
interface VarianteRow {
  id: number;
  articleId: number;
  taille: string | null;
  couleur: string | null;
  stockDetail: number | null;
}

const PRESET_ZONES = [
  { label: "Poitrine centre", x: 50, y: 30 },
  { label: "Poitrine gauche", x: 38, y: 28 },
  { label: "Poitrine droite", x: 62, y: 28 },
  { label: "Dos", x: 50, y: 55 },
  { label: "Manche courte", x: 15, y: 30 },
  { label: "Manche longue", x: 15, y: 55 },
];

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}
let localId = 1;
function nextLocalId() {
  return `z${localId++}`;
}

function GarmentStage({
  photoUrl,
  zones,
  selectedId,
  onSelect,
  onAdd,
  disabled,
}: {
  photoUrl: string | null;
  zones: ZoneConfig[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (x: number, y: number) => void;
  disabled: boolean;
}) {
  return (
    <div
      onClick={(e) => {
        if (disabled) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        onAdd(x, y);
      }}
      className="relative h-[360px] cursor-crosshair overflow-hidden rounded-md border border-border bg-muted"
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          Pas de photo — cliquez quand même pour placer une zone
        </div>
      )}
      {zones.length === 0 && !disabled && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-10 text-center text-xs text-white/90">
          <span className="rounded bg-black/50 px-2 py-1">Cliquez sur le produit pour placer une zone</span>
        </div>
      )}
      {zones.map((z, i) => (
        <button
          key={z.id}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(z.id);
          }}
          style={{ left: `${z.x ?? 50}%`, top: `${z.y ?? 50}%` }}
          className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-primary-foreground shadow ${
            z.id === selectedId ? "bg-amber-500" : "bg-primary"
          }`}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}

export function RdCalculateursClient({
  userName,
  roleLibelle,
  modules,
  articles: initialArticles,
  variantes,
  clients: initialClients,
  biblio,
  parametres,
  modelesPrets,
  isAdmin,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  articles: Article[];
  variantes: VarianteRow[];
  clients: Client[];
  biblio: Bibliotheque;
  parametres: { mainOeuvreDefaut: number; margeDefaut: number };
  modelesPrets: ModelePret[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [modeAchat, setModeAchat] = useState<"libre" | "modele">("libre");
  const [modeleId, setModeleId] = useState<number | "">("");
  const [modeleVarianteId, setModeleVarianteId] = useState<number | "">("");
  const [modeleQuantite, setModeleQuantite] = useState(1);
  const [modeleClientId, setModeleClientId] = useState<number | "">("");
  const [modelePending, setModelePending] = useState(false);
  const [modeleErreur, setModeleErreur] = useState<string | null>(null);
  const [modeleSucces, setModeleSucces] = useState<string | null>(null);
  const [articleId, setArticleId] = useState<number | "">("");
  const [varianteId, setVarianteId] = useState<number | "">("");
  const [zones, setZones] = useState<ZoneConfig[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [ensembleOn, setEnsembleOn] = useState(false);
  const [basArticleId, setBasArticleId] = useState<number | "">("");
  const [basVarianteId, setBasVarianteId] = useState<number | "">("");
  const [tissuMode, setTissuMode] = useState<"zones" | "surface">("zones");
  const [surfaceL, setSurfaceL] = useState(150);
  const [surfaceH, setSurfaceH] = useState(100);
  const [mainOeuvre, setMainOeuvre] = useState(parametres.mainOeuvreDefaut);
  const [marge, setMarge] = useState(parametres.margeDefaut);
  const [charges, setCharges] = useState<ChargeAdditionnelle[]>([]);
  const [clientId, setClientId] = useState<number | "">("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const article = initialArticles.find((a) => a.id === articleId) || null;
  const variantesArticle = variantes.filter((v) => v.articleId === articleId);
  const variante = variantesArticle.find((v) => v.id === varianteId) || null;
  const isTissu = article?.categorieMarquage === "TISSU";
  const isEnsembleEligible = article?.categorieMarquage === "ENSEMBLE";

  const basArticles = initialArticles.filter((a) => a.famille === "A" && a.id !== articleId);
  const basArticle = initialArticles.find((a) => a.id === basArticleId) || null;
  const basVariantesList = variantes.filter((v) => v.articleId === basArticleId);
  const basVariante = basVariantesList.find((v) => v.id === basVarianteId) || null;

  const ligneBas: LigneBase | null =
    ensembleOn && basArticle && basVariante
      ? { articleId: basArticle.id, varianteId: basVariante.id, quantite: 1, prixUnitaire: Number(basArticle.prixVente) }
      : null;

  const calcul = useMemo(
    () =>
      calculerTotal(
        {
          prixBaseArticle: article ? Number(article.prixVente) : 0,
          zones,
          mainOeuvre,
          charges,
          marge,
          prixBas: ligneBas?.prixUnitaire,
        },
        biblio
      ),
    [article, zones, mainOeuvre, charges, marge, ligneBas, biblio]
  );

  function selectArticle(id: number) {
    setArticleId(id);
    setVarianteId("");
    setZones([]);
    setSelectedZoneId(null);
    setEnsembleOn(false);
    setTissuMode("zones");
  }

  function addZone(x: number, y: number, label?: string) {
    const z: ZoneConfig = {
      id: nextLocalId(),
      label: label ?? `Zone ${zones.length + 1}`,
      technique: "SERIGRAPHIE",
      largeurCm: 10,
      hauteurCm: 10,
      cadreId: biblio.cadres[0]?.id ?? null,
      encreId: null,
      supportId: null,
      palierBroderieId: biblio.paliersBroderie[0]?.id ?? null,
      x,
      y,
    };
    setZones((prev) => [...prev, z]);
    setSelectedZoneId(z.id);
  }

  function updateZone(id: string, patch: Partial<ZoneConfig>) {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  }

  function onTechniqueChange(id: string, technique: Technique) {
    const patch: Partial<ZoneConfig> = { technique };
    if (technique === "DTF") {
      patch.encreId = biblio.encres.find((e) => e.technique === "DTF")?.id ?? null;
      patch.supportId = biblio.supports.find((s) => s.technique === "DTF")?.id ?? null;
    } else if (technique === "SUBLIMATION") {
      patch.encreId = biblio.encres.find((e) => e.technique === "SUBLIMATION")?.id ?? null;
      patch.supportId = biblio.supports.find((s) => s.technique === "SUBLIMATION")?.id ?? null;
    } else if (technique === "FLOCAGE") {
      patch.supportId = biblio.supports.find((s) => s.technique === "FLOCAGE")?.id ?? null;
    }
    updateZone(id, patch);
  }

  function setTissu(mode: "zones" | "surface") {
    setTissuMode(mode);
    if (mode === "surface") {
      const z: ZoneConfig = {
        id: nextLocalId(),
        label: "Toute la surface",
        technique: "SUBLIMATION",
        largeurCm: surfaceL,
        hauteurCm: surfaceH,
        cadreId: null,
        encreId: biblio.encres.find((e) => e.technique === "SUBLIMATION")?.id ?? null,
        supportId: biblio.supports.find((s) => s.technique === "SUBLIMATION")?.id ?? null,
        palierBroderieId: null,
      };
      setZones([z]);
      setSelectedZoneId(z.id);
    } else {
      setZones([]);
      setSelectedZoneId(null);
    }
  }

  async function handleCreer() {
    if (!article || !variante || !clientId) {
      setErreur("Client, article et variante requis.");
      return;
    }
    setPending(true);
    setErreur(null);
    setSucces(null);
    const res = await creerAffaireAvecMarquage(
      Number(clientId),
      { articleId: article.id, varianteId: variante.id, quantite: 1, prixUnitaire: Number(article.prixVente) },
      zones,
      mainOeuvre,
      charges,
      marge,
      ligneBas
    );
    setPending(false);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    setSucces(`Affaire créée. Ouvrez /affaires pour la valider.`);
    setZones([]);
    router.refresh();
  }

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="R&D" modules={modules}>
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">Marquage personnalisé (§10bis)</h1>
            <AideBulle titre="Comment utiliser R&D Calculateurs">
              <p>
                Choisis un article déjà en Stock, puis configure un marquage (ex. broderie ou sérigraphie sur un polo) — le calculateur donne un prix, mais ça reste une ligne de vente calculée : ça ne crée jamais un nouvel article dans le Catalogue.
              </p>
              <p>
                <b>Configuration libre</b> — tu choisis chaque option toi-même. <b>Modèles prêts</b> — repars d&apos;une combinaison déjà enregistrée pour aller plus vite.
              </p>
            </AideBulle>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Configurez un marquage sur un article existant du Stock — une vente configurée devient
            une ligne d&apos;affaire calculée, jamais un nouvel article Catalogue.
          </p>
        </div>
        <button
          onClick={() => setAdminOpen(true)}
          className="mt-1 h-2.5 w-2.5 flex-none rounded-full bg-muted-foreground/30 hover:bg-primary"
          title="Configuration avancée — Admin/Super Admin"
        />
      </div>

      <div className="mt-4 inline-flex overflow-hidden rounded-full border border-border text-xs">
        <button
          onClick={() => setModeAchat("libre")}
          className={`px-3 py-1.5 font-semibold ${modeAchat === "libre" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
        >
          Configuration libre
        </button>
        <button
          onClick={() => setModeAchat("modele")}
          className={`px-3 py-1.5 font-semibold ${modeAchat === "modele" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
        >
          Modèles prêts ({modelesPrets.length})
        </button>
      </div>

      {modeAchat === "modele" && (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
          <div className="max-h-[calc(100vh-220px)] overflow-y-auto rounded-md border border-border bg-card">
            {modelesPrets.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setModeleId(m.id);
                  setModeleVarianteId("");
                  setModeleErreur(null);
                  setModeleSucces(null);
                }}
                className={`block w-full border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0 ${
                  m.id === modeleId ? "bg-primary/10 font-semibold text-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {m.nom} <span className="text-xs text-muted-foreground">({m.articleNom})</span>
              </button>
            ))}
            {modelesPrets.length === 0 && <p className="p-3 text-xs text-muted-foreground">Aucun modèle prêt — à créer depuis Catalogue &gt; Paramètres.</p>}
          </div>
          <div className="space-y-4">
            {(() => {
              const modele = modelesPrets.find((m) => m.id === modeleId) ?? null;
              if (!modele) {
                return (
                  <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Choisissez un modèle prêt dans la liste à gauche.
                  </p>
                );
              }
              const variantesModele = variantes.filter((v) => v.articleId === modele.articleId);
              const total = modele.prixDepart * modeleQuantite;
              return (
                <div className="rounded-md border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={modele.photoUrl} alt="" className="h-16 w-16 flex-none rounded-md object-cover" />
                    <div>
                      <div className="text-sm font-semibold text-foreground">{modele.nom}</div>
                      <div className="text-xs text-muted-foreground">{modele.articleNom} — {fmt(modele.prixDepart)} / pièce</div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {modele.zones.map((z) => (
                      <span key={z.id} className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                        {z.label} — {z.technique}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <select
                      value={modeleVarianteId}
                      onChange={(e) => setModeleVarianteId(Number(e.target.value))}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">Choisir une variante (taille/couleur)...</option>
                      {variantesModele.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.taille} {v.couleur} — dispo {v.stockDetail ?? 0}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min="1"
                      value={modeleQuantite}
                      onChange={(e) => setModeleQuantite(Math.max(1, Number(e.target.value)))}
                      placeholder="Quantité"
                    />
                  </div>

                  <div className="mt-3">
                    <select
                      value={modeleClientId}
                      onChange={(e) => setModeleClientId(Number(e.target.value))}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">Choisir un client...</option>
                      {initialClients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nom}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
                    <span className="text-sm font-semibold text-foreground">Prix total ({modeleQuantite} × {fmt(modele.prixDepart)})</span>
                    <b className="text-xl text-amber-700 dark:text-amber-400">{fmt(total)}</b>
                  </div>

                  {modeleErreur && <p className="mt-2 text-xs text-destructive">{modeleErreur}</p>}
                  {modeleSucces && <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{modeleSucces}</p>}
                  <Button
                    className="mt-3 w-full"
                    disabled={modelePending || !modeleVarianteId || !modeleClientId}
                    onClick={async () => {
                      setModelePending(true);
                      setModeleErreur(null);
                      setModeleSucces(null);
                      const res = await creerAffaireDepuisModele(Number(modeleClientId), modele.id, Number(modeleVarianteId), modeleQuantite);
                      setModelePending(false);
                      if (res.error) {
                        setModeleErreur(res.error);
                        return;
                      }
                      setModeleSucces("Affaire créée. Ouvrez /affaires pour la valider.");
                      router.refresh();
                    }}
                  >
                    {modelePending ? "Création..." : "Créer l'affaire (Commande en attente)"}
                  </Button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {modeAchat === "libre" && (
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto rounded-md border border-border bg-card">
          {initialArticles.filter((a) => a.famille === "A").map((a) => (
            <button
              key={a.id}
              onClick={() => selectArticle(a.id)}
              className={`block w-full border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0 ${
                a.id === articleId ? "bg-primary/10 font-semibold text-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {a.nom} <span className="text-xs text-muted-foreground">({a.code})</span>
            </button>
          ))}
          {initialArticles.filter((a) => a.famille === "A").length === 0 && (
            <p className="p-3 text-xs text-muted-foreground">Aucun article Famille A.</p>
          )}
        </div>
        <div className="space-y-4">
          {!article && (
            <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Choisissez un article dans la liste à gauche.
            </p>
          )}
          <div className="rounded-md border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-2">
              {article && (
                <select
                  value={varianteId}
                  onChange={(e) => setVarianteId(Number(e.target.value))}
                  className="col-span-2 h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Choisir une variante (taille/couleur)...</option>
                  {variantesArticle.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.taille} {v.couleur} — dispo {v.stockDetail ?? 0}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {article && (
              <>
                {isTissu && (
                  <div className="mt-3 inline-flex overflow-hidden rounded-full border border-border text-xs">
                    <button
                      onClick={() => setTissu("zones")}
                      className={`px-3 py-1.5 font-semibold ${tissuMode === "zones" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
                    >
                      Zones spécifiques
                    </button>
                    <button
                      onClick={() => setTissu("surface")}
                      className={`px-3 py-1.5 font-semibold ${tissuMode === "surface" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
                    >
                      Toute la surface
                    </button>
                  </div>
                )}

                {isEnsembleEligible && (
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={ensembleOn} onChange={(e) => setEnsembleOn(e.target.checked)} />
                    Ensemble complet (haut + bas)
                  </label>
                )}

                {isTissu && tissuMode === "surface" ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Largeur (cm)</label>
                      <Input
                        type="number"
                        value={surfaceL}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setSurfaceL(v);
                          if (zones[0]) updateZone(zones[0].id, { largeurCm: v });
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Hauteur (cm)</label>
                      <Input
                        type="number"
                        value={surfaceH}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setSurfaceH(v);
                          if (zones[0]) updateZone(zones[0].id, { hauteurCm: v });
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {!isTissu && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {PRESET_ZONES.map((p) => (
                          <button
                            key={p.label}
                            onClick={() => addZone(p.x, p.y, p.label)}
                            className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
                          >
                            + {p.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="mt-3">
                      <GarmentStage
                        photoUrl={variante ? null : article.photoUrl}
                        zones={zones}
                        selectedId={selectedZoneId}
                        onSelect={setSelectedZoneId}
                        onAdd={(x, y) => addZone(x, y)}
                        disabled={false}
                      />
                    </div>
                  </>
                )}

                {ensembleOn && isEnsembleEligible && (
                  <div className="mt-3 rounded-md border border-dashed border-primary bg-primary/5 p-3">
                    <div className="mb-2 text-xs font-bold uppercase text-primary">Bas de l&apos;ensemble</div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={basArticleId}
                        onChange={(e) => {
                          setBasArticleId(Number(e.target.value));
                          setBasVarianteId("");
                        }}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="">Choisir un article...</option>
                        {basArticles.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nom}
                          </option>
                        ))}
                      </select>
                      <select
                        value={basVarianteId}
                        onChange={(e) => setBasVarianteId(Number(e.target.value))}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="">Variante...</option>
                        {basVariantesList.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.taille} {v.couleur} — dispo {v.stockDetail ?? 0}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-2">
            {zones.map((z, i) => {
              const cost = calcul.zoneResultats.find((r) => r.zoneId === z.id);
              const open = z.id === selectedZoneId;
              return (
                <div
                  key={z.id}
                  className={`rounded-md border p-3 text-sm ${open ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                >
                  <div
                    className="flex cursor-pointer items-center justify-between"
                    onClick={() => setSelectedZoneId(open ? null : z.id)}
                  >
                    <b>
                      {z.label} — {cost?.detailLabel ?? ""}
                    </b>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{fmt(cost?.montant ?? 0)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setZones((prev) => prev.filter((x) => x.id !== z.id));
                        }}
                        className="text-xs text-destructive"
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                  {open && (
                    <div className="mt-3 space-y-2 border-t border-border pt-3">
                      {z.label !== "Toute la surface" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Largeur (cm)</label>
                            <Input
                              type="number"
                              value={z.largeurCm}
                              disabled={z.technique === "SERIGRAPHIE" || z.technique === "BRODERIE"}
                              onChange={(e) => updateZone(z.id, { largeurCm: Number(e.target.value) })}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Hauteur (cm)</label>
                            <Input
                              type="number"
                              value={z.hauteurCm}
                              disabled={z.technique === "SERIGRAPHIE" || z.technique === "BRODERIE"}
                              onChange={(e) => updateZone(z.id, { hauteurCm: Number(e.target.value) })}
                            />
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {(["SERIGRAPHIE", "SUBLIMATION", "DTF", "FLOCAGE", "BRODERIE"] as Technique[]).map((t) => (
                          <button
                            key={t}
                            onClick={() => onTechniqueChange(z.id, t)}
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${z.technique === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
                          >
                            {t === "SERIGRAPHIE" ? "Sérigraphie" : t === "SUBLIMATION" ? "Sublimation" : t === "DTF" ? "DTF" : t === "FLOCAGE" ? "Flocage" : "Broderie"}
                          </button>
                        ))}
                      </div>
                      {z.technique === "SERIGRAPHIE" && (
                        <select
                          value={z.cadreId ?? ""}
                          onChange={(e) => updateZone(z.id, { cadreId: Number(e.target.value) })}
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {biblio.cadres.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nom} — {fmt(c.prixCadre)}
                            </option>
                          ))}
                        </select>
                      )}
                      {z.technique === "BRODERIE" && (
                        <select
                          value={z.palierBroderieId ?? ""}
                          onChange={(e) => updateZone(z.id, { palierBroderieId: Number(e.target.value) })}
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {biblio.paliersBroderie.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nom} — {fmt(p.prix)}
                            </option>
                          ))}
                        </select>
                      )}
                      {(z.technique === "SUBLIMATION" || z.technique === "DTF") && (
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={z.encreId ?? ""}
                            onChange={(e) => updateZone(z.id, { encreId: Number(e.target.value) })}
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            {biblio.encres.filter((en) => en.technique === z.technique).map((en) => (
                              <option key={en.id} value={en.id}>
                                {en.nom}
                              </option>
                            ))}
                          </select>
                          <select
                            value={z.supportId ?? ""}
                            onChange={(e) => updateZone(z.id, { supportId: Number(e.target.value) })}
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            {biblio.supports.filter((s) => s.technique === z.technique).map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.nom}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {z.technique === "FLOCAGE" && (
                        <select
                          value={z.supportId ?? ""}
                          onChange={(e) => updateZone(z.id, { supportId: Number(e.target.value) })}
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {biblio.supports.filter((s) => s.technique === "FLOCAGE").map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.nom}
                            </option>
                          ))}
                        </select>
                      )}
                      {(cost?.detailEncre !== undefined || cost?.detailSupport !== undefined) && (
                        <p className="rounded bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                          {cost.detailEncre !== undefined && (
                            <>
                              Encre : {fmt(cost.detailEncre)}
                              {cost.mlConsommes !== undefined && <> ({cost.mlConsommes.toFixed(1)} ml)</>} ·{" "}
                            </>
                          )}
                          Support ({cost.feuilles ?? 1} feuille(s)) : {fmt(cost.detailSupport ?? 0)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {zones.length === 0 && (
              <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Aucune zone — cliquez sur le produit ou un bouton rapide ci-dessus.
              </p>
            )}
          </div>

          <div className="rounded-md border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">Prix</h2>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between border-b border-border py-1.5">
                <span className="text-muted-foreground">{article ? article.nom : "Article"} (base, Stock)</span>
                <span>{fmt(article ? Number(article.prixVente) : 0)}</span>
              </div>
              {ligneBas && (
                <div className="flex justify-between border-b border-border py-1.5">
                  <span className="text-muted-foreground">Bas — {basArticle?.nom}</span>
                  <span>{fmt(ligneBas.prixUnitaire)}</span>
                </div>
              )}
              {calcul.zoneResultats.map((z, i) => (
                <div key={z.zoneId} className="flex justify-between border-b border-border py-1.5">
                  <span className="text-muted-foreground">
                    {zones[i]?.label} — {z.detailLabel}
                  </span>
                  <span>{fmt(z.montant)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-b border-border py-1.5">
                <span className="text-muted-foreground">Main d&apos;œuvre</span>
                <Input
                  type="number"
                  value={mainOeuvre}
                  onChange={(e) => setMainOeuvre(Number(e.target.value))}
                  className="h-7 w-24 text-right"
                />
              </div>
              <div className="space-y-1 border-b border-border py-1.5">
                <div className="flex justify-between text-muted-foreground">
                  <span>Charges additionnelles</span>
                  <span>{fmt(calcul.totalCharges)}</span>
                </div>
                {charges.map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input
                      value={c.nom}
                      onChange={(e) =>
                        setCharges((prev) => prev.map((x, idx) => (idx === i ? { ...x, nom: e.target.value } : x)))
                      }
                      placeholder="Ex. transport local"
                      className="h-7 flex-1 text-xs"
                    />
                    <Input
                      type="number"
                      value={c.montant}
                      onChange={(e) =>
                        setCharges((prev) => prev.map((x, idx) => (idx === i ? { ...x, montant: Number(e.target.value) } : x)))
                      }
                      className="h-7 w-20 text-xs"
                    />
                    <button onClick={() => setCharges((prev) => prev.filter((_, idx) => idx !== i))} className="text-xs text-destructive">
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setCharges((prev) => [...prev, { nom: "", montant: 0 }])}
                  className="text-xs font-semibold text-primary"
                >
                  + Ajouter une charge
                </button>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Marge</span>
                <Input type="number" value={marge} onChange={(e) => setMarge(Number(e.target.value))} className="h-7 w-24 text-right" />
              </div>
              <div className="flex items-baseline justify-between border-t-2 border-foreground pt-2">
                <span className="text-sm font-semibold">Prix unitaire</span>
                <b className="text-xl text-amber-700 dark:text-amber-400">{fmt(calcul.total)}</b>
              </div>
            </div>

            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <select
                value={clientId}
                onChange={(e) => setClientId(Number(e.target.value))}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Choisir un client...</option>
                {initialClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
              {erreur && <p className="text-xs text-destructive">{erreur}</p>}
              {succes && <p className="text-xs text-emerald-700 dark:text-emerald-400">{succes}</p>}
              <Button className="w-full" disabled={pending || !article || !variante || !clientId} onClick={handleCreer}>
                {pending ? "Création..." : "Créer l'affaire (Commande en attente)"}
              </Button>
            </div>
          </div>
        </div>
      </div>
      )}

      {adminOpen && (
        <AdminModal biblio={biblio} parametres={parametres} isAdmin={isAdmin} onClose={() => setAdminOpen(false)} />
      )}
    </div>
    </AppShell>
  );
}

function AdminModal({
  biblio,
  parametres,
  isAdmin,
  onClose,
}: {
  biblio: Bibliotheque;
  parametres: { mainOeuvreDefaut: number; margeDefaut: number };
  isAdmin: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"encres" | "supports" | "cadres" | "broderie" | "regles">("encres");
  const [mo, setMo] = useState(parametres.mainOeuvreDefaut);
  const [mg, setMg] = useState(parametres.margeDefaut);

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
        <div className="rounded-md bg-background p-6 text-sm" onClick={(e) => e.stopPropagation()}>
          Réservé Admin/Super Admin.
          <div className="mt-3">
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  async function prix(categorie: "encre" | "support" | "cadre" | "broderie", id: number, val: string) {
    await modifierPrixReference(categorie, id, Number(val));
    router.refresh();
  }
  async function qteMl(id: number, val: string) {
    await modifierQteReferenceMlEncre(id, val.trim() === "" ? null : Number(val));
    router.refresh();
  }
  async function surfaceRef(id: number, val: string) {
    await modifierSurfaceReferenceEncre(id, Number(val));
    router.refresh();
  }
  async function retirer(categorie: "encre" | "support" | "cadre" | "broderie", id: number) {
    await retirerReference(categorie, id);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-6" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg bg-background p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Configuration des calculateurs</h2>
          <button onClick={onClose} className="text-xl text-muted-foreground">
            &times;
          </button>
        </div>
        <span className="mt-1 inline-block rounded bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">
          Réservé Admin/Super Admin — invisible du reste de l&apos;équipe
        </span>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(["encres", "supports", "cadres", "broderie", "regles"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${tab === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
            >
              {t === "encres" ? "Encres" : t === "supports" ? "Supports" : t === "cadres" ? "Sérigraphie" : t === "broderie" ? "Broderie" : "Main d'œuvre / marge"}
            </button>
          ))}
        </div>

        {tab === "encres" && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.5fr] gap-2 px-1 text-[10px] font-semibold uppercase text-muted-foreground">
              <span>Nom</span>
              <span>Technique</span>
              <span>Prix</span>
              <span>Qté (ml)</span>
              <span>Rendement (cm²)</span>
            </div>
            {biblio.encres.map((e) => (
              <div key={e.id} className="grid grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.5fr] items-center gap-2 text-xs">
                <span>{e.nom}</span>
                <span className="text-muted-foreground">{e.technique}</span>
                <Input type="number" defaultValue={e.prixReference} onBlur={(ev) => prix("encre", e.id, ev.target.value)} className="h-7" />
                <Input type="number" defaultValue={e.qteReferenceMl ?? ""} placeholder="ex. 100" onBlur={(ev) => qteMl(e.id, ev.target.value)} className="h-7" />
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    defaultValue={e.surfaceReferenceCm2}
                    onBlur={(ev) => surfaceRef(e.id, ev.target.value)}
                    className="h-7"
                  />
                  <button onClick={() => retirer("encre", e.id)} className="text-destructive">
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <AjoutEncreForm onDone={() => router.refresh()} />
          </div>
        )}

        {tab === "supports" && (
          <div className="mt-3 space-y-2">
            {biblio.supports.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <span className="flex-1">
                  {s.nom} ({s.technique}, {s.largeurCm}×{s.hauteurCm}cm)
                </span>
                <Input type="number" defaultValue={s.prix} onBlur={(ev) => prix("support", s.id, ev.target.value)} className="h-7 w-24" />
                <button onClick={() => retirer("support", s.id)} className="text-destructive">
                  Retirer
                </button>
              </div>
            ))}
            <AjoutSupportForm onDone={() => router.refresh()} />
          </div>
        )}

        {tab === "cadres" && (
          <div className="mt-3 space-y-2">
            {biblio.cadres.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <span className="flex-1">{c.nom}</span>
                <Input type="number" defaultValue={c.prixCadre} onBlur={(ev) => prix("cadre", c.id, ev.target.value)} className="h-7 w-24" />
                <button onClick={() => retirer("cadre", c.id)} className="text-destructive">
                  Retirer
                </button>
              </div>
            ))}
            <AjoutCadreForm onDone={() => router.refresh()} />
          </div>
        )}

        {tab === "broderie" && (
          <div className="mt-3 space-y-2">
            {biblio.paliersBroderie.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-xs">
                <span className="flex-1">{p.nom}</span>
                <Input type="number" defaultValue={p.prix} onBlur={(ev) => prix("broderie", p.id, ev.target.value)} className="h-7 w-24" />
                <button onClick={() => retirer("broderie", p.id)} className="text-destructive">
                  Retirer
                </button>
              </div>
            ))}
            <AjoutBroderieForm onDone={() => router.refresh()} />
          </div>
        )}

        {tab === "regles" && (
          <div className="mt-3 space-y-3 text-xs">
            <div>
              <label className="mb-1 block font-semibold uppercase text-muted-foreground">Main d&apos;œuvre par défaut</label>
              <Input type="number" value={mo} onChange={(e) => setMo(Number(e.target.value))} className="h-8 w-32" />
            </div>
            <div>
              <label className="mb-1 block font-semibold uppercase text-muted-foreground">Marge par défaut</label>
              <Input type="number" value={mg} onChange={(e) => setMg(Number(e.target.value))} className="h-8 w-32" />
            </div>
            <Button
              size="sm"
              onClick={async () => {
                await definirParametresMarquage(mo, mg);
                router.refresh();
              }}
            >
              Enregistrer
            </Button>
          </div>
        )}

        <div className="mt-4 flex justify-end border-t border-border pt-3">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}

function AjoutEncreForm({ onDone }: { onDone: () => void }) {
  const [nom, setNom] = useState("");
  const [technique, setTechnique] = useState("SUBLIMATION");
  const [prixReference, setPrixReference] = useState("");
  const [qteReferenceMl, setQteReferenceMl] = useState("100");
  const [surfaceReferenceCm2, setSurfaceReferenceCm2] = useState("609");
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <div className="rounded border border-dashed border-border p-2">
      <div className="grid grid-cols-5 gap-1.5">
        <Input placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} className="h-7 text-xs" />
        <select value={technique} onChange={(e) => setTechnique(e.target.value)} className="h-7 rounded border border-input bg-background text-xs">
          <option value="SUBLIMATION">Sublimation</option>
          <option value="DTF">DTF</option>
        </select>
        <Input placeholder="Prix" type="number" value={prixReference} onChange={(e) => setPrixReference(e.target.value)} className="h-7 text-xs" />
        <Input placeholder="Qté (ml)" type="number" value={qteReferenceMl} onChange={(e) => setQteReferenceMl(e.target.value)} className="h-7 text-xs" />
        <Input placeholder="Rendement cm²" type="number" value={surfaceReferenceCm2} onChange={(e) => setSurfaceReferenceCm2(e.target.value)} className="h-7 text-xs" />
      </div>
      {erreur && <p className="mt-1 text-destructive">{erreur}</p>}
      <button
        className="mt-1.5 font-semibold text-primary"
        onClick={async () => {
          const fd = new FormData();
          fd.set("nom", nom);
          fd.set("technique", technique);
          fd.set("prixReference", prixReference);
          fd.set("qteReferenceMl", qteReferenceMl);
          fd.set("surfaceReferenceCm2", surfaceReferenceCm2);
          const res = await ajouterEncre({ error: null }, fd);
          if (res.error) setErreur(res.error);
          else {
            setNom("");
            setPrixReference("");
            onDone();
          }
        }}
      >
        + Ajouter une encre
      </button>
    </div>
  );
}

function AjoutSupportForm({ onDone }: { onDone: () => void }) {
  const [nom, setNom] = useState("");
  const [technique, setTechnique] = useState("SUBLIMATION");
  const [prix, setPrix] = useState("");
  const [largeurCm, setLargeurCm] = useState("29");
  const [hauteurCm, setHauteurCm] = useState("21");
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <div className="rounded border border-dashed border-border p-2">
      <div className="grid grid-cols-5 gap-1.5">
        <Input placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} className="h-7 text-xs" />
        <select value={technique} onChange={(e) => setTechnique(e.target.value)} className="h-7 rounded border border-input bg-background text-xs">
          <option value="SUBLIMATION">Sublimation</option>
          <option value="DTF">DTF</option>
          <option value="FLOCAGE">Flocage</option>
        </select>
        <Input placeholder="Prix" type="number" value={prix} onChange={(e) => setPrix(e.target.value)} className="h-7 text-xs" />
        <Input placeholder="Largeur cm" type="number" value={largeurCm} onChange={(e) => setLargeurCm(e.target.value)} className="h-7 text-xs" />
        <Input placeholder="Hauteur cm" type="number" value={hauteurCm} onChange={(e) => setHauteurCm(e.target.value)} className="h-7 text-xs" />
      </div>
      {erreur && <p className="mt-1 text-destructive">{erreur}</p>}
      <button
        className="mt-1.5 font-semibold text-primary"
        onClick={async () => {
          const fd = new FormData();
          fd.set("nom", nom);
          fd.set("technique", technique);
          fd.set("prix", prix);
          fd.set("largeurCm", largeurCm);
          fd.set("hauteurCm", hauteurCm);
          const res = await ajouterSupport({ error: null }, fd);
          if (res.error) setErreur(res.error);
          else {
            setNom("");
            setPrix("");
            onDone();
          }
        }}
      >
        + Ajouter un support
      </button>
    </div>
  );
}

function AjoutCadreForm({ onDone }: { onDone: () => void }) {
  const [nom, setNom] = useState("");
  const [prixCadre, setPrixCadre] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <div className="rounded border border-dashed border-border p-2">
      <div className="grid grid-cols-2 gap-1.5">
        <Input placeholder="Nom (ex. 5 couleurs)" value={nom} onChange={(e) => setNom(e.target.value)} className="h-7 text-xs" />
        <Input placeholder="Prix cadre" type="number" value={prixCadre} onChange={(e) => setPrixCadre(e.target.value)} className="h-7 text-xs" />
      </div>
      {erreur && <p className="mt-1 text-destructive">{erreur}</p>}
      <button
        className="mt-1.5 font-semibold text-primary"
        onClick={async () => {
          const fd = new FormData();
          fd.set("nom", nom);
          fd.set("prixCadre", prixCadre);
          const res = await ajouterCadre({ error: null }, fd);
          if (res.error) setErreur(res.error);
          else {
            setNom("");
            setPrixCadre("");
            onDone();
          }
        }}
      >
        + Ajouter un palier
      </button>
    </div>
  );
}

function AjoutBroderieForm({ onDone }: { onDone: () => void }) {
  const [nom, setNom] = useState("");
  const [prix, setPrix] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <div className="rounded border border-dashed border-border p-2">
      <div className="grid grid-cols-2 gap-1.5">
        <Input placeholder="Nom (ex. Très grand)" value={nom} onChange={(e) => setNom(e.target.value)} className="h-7 text-xs" />
        <Input placeholder="Prix" type="number" value={prix} onChange={(e) => setPrix(e.target.value)} className="h-7 text-xs" />
      </div>
      {erreur && <p className="mt-1 text-destructive">{erreur}</p>}
      <button
        className="mt-1.5 font-semibold text-primary"
        onClick={async () => {
          const fd = new FormData();
          fd.set("nom", nom);
          fd.set("prix", prix);
          const res = await ajouterPalierBroderie({ error: null }, fd);
          if (res.error) setErreur(res.error);
          else {
            setNom("");
            setPrix("");
            onDone();
          }
        }}
      >
        + Ajouter une taille
      </button>
    </div>
  );
}
