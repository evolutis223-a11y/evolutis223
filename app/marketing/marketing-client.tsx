"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell, type ShellModule } from "@/components/app-shell";
import { AideBulle } from "@/components/ui/aide-bulle";
import { ajouterPromotion, definirBanniere, retirerPromotion } from "./actions";

type Promotion = {
  id: number;
  nom: string;
  articleId: number;
  articleNom: string;
  prixVente: number;
  type: string;
  valeur: number;
  dateDebut: string;
  dateFin: string;
  actif: boolean;
};
type ArticleOpt = { id: number; nom: string; code: string; prixVente: number };

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}
function prixPromo(p: { prixVente: number; type: string; valeur: number }) {
  return p.type === "POURCENTAGE" ? p.prixVente * (1 - p.valeur / 100) : Math.max(0, p.prixVente - p.valeur);
}
function ajourdhui() {
  return new Date().toISOString().slice(0, 10);
}

export function MarketingClient({
  userName,
  roleLibelle,
  modules,
  promotions: initialPromotions,
  articles,
  messageBanniere: initialMessage,
  banniereActive: initialActive,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  promotions: Promotion[];
  articles: ArticleOpt[];
  messageBanniere: string;
  banniereActive: boolean;
}) {
  const [tab, setTab] = useState<"promotions" | "banniere">("promotions");
  const [promotions, setPromotions] = useState(initialPromotions);

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Marketing" modules={modules}>
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-foreground">Marketing (§7)</h1>
        <AideBulle titre="Comment utiliser Marketing">
          <p>
            <b>Promotions</b> — choisis un article, une réduction (pourcentage ou montant fixe) et une période. Le prix barré apparaît en boutique, mais le prix du Catalogue n&apos;est jamais touché : à la fin de la promotion, tout revient au prix normal automatiquement.
          </p>
          <p>
            <b>Bannière boutique</b> — le message qui défile en haut de la boutique en ligne (ex. &quot;Livraison offerte à Bamako dès 3 pièces&quot;). Un interrupteur pour l&apos;activer/désactiver sans effacer le texte.
          </p>
        </AideBulle>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Promotions sur les prix affichés en boutique et bannière d&apos;annonce — le prix réel du Catalogue n&apos;est jamais
        modifié, la promotion est une couche d&apos;affichage réversible. Voir <Link href="/boutique" className="text-primary hover:underline">/boutique</Link> pour le rendu client.
      </p>

      <div className="mt-5 flex gap-1.5 border-b border-border">
        {(["promotions", "banniere"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-md border border-b-0 px-4 py-2 text-sm font-semibold ${tab === t ? "border-border bg-muted text-foreground" : "border-transparent text-muted-foreground"}`}
          >
            {t === "promotions" ? "Promotions" : "Bannière boutique"}
          </button>
        ))}
      </div>

      <div className="rounded-b-md border border-border bg-muted/30 p-5">
        {tab === "promotions" && (
          <PromotionsTab promotions={promotions} setPromotions={setPromotions} articles={articles} />
        )}
        {tab === "banniere" && <BanniereTab initialMessage={initialMessage} initialActive={initialActive} />}
      </div>
    </div>
    </AppShell>
  );
}

function ChampLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function PromotionsTab({
  promotions,
  setPromotions,
  articles,
}: {
  promotions: Promotion[];
  setPromotions: (fn: (p: Promotion[]) => Promotion[]) => void;
  articles: ArticleOpt[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nom, setNom] = useState("");
  const [articleId, setArticleId] = useState("");
  const [type, setType] = useState("POURCENTAGE");
  const [valeur, setValeur] = useState("");
  const [dateDebut, setDateDebut] = useState(ajourdhui());
  const [dateFin, setDateFin] = useState("");
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const articleChoisi = articles.find((a) => a.id === Number(articleId));
  const valeurNum = Number(valeur);
  const previewValide = articleChoisi && Number.isFinite(valeurNum) && valeurNum > 0;
  const prixApres = previewValide
    ? type === "POURCENTAGE"
      ? articleChoisi!.prixVente * (1 - valeurNum / 100)
      : Math.max(0, articleChoisi!.prixVente - valeurNum)
    : null;

  function fermerDrawer() {
    setDrawerOpen(false);
    setErreur(null);
    setNom("");
    setArticleId("");
    setValeur("");
    setDateDebut(ajourdhui());
    setDateFin("");
  }

  async function handleAjouter() {
    const article = articles.find((a) => a.id === Number(articleId));
    const v = Number(valeur);
    if (!nom.trim() || !article || !Number.isFinite(v) || v <= 0 || !dateFin) {
      setErreur("Tous les champs sont requis.");
      return;
    }
    setPending(true);
    setErreur(null);
    const fd = new FormData();
    fd.set("nom", nom);
    fd.set("articleId", articleId);
    fd.set("type", type);
    fd.set("valeur", valeur);
    fd.set("dateDebut", dateDebut);
    fd.set("dateFin", dateFin);
    const res = await ajouterPromotion({ error: null }, fd);
    setPending(false);
    if (res.error || !res.promotionId) {
      setErreur(res.error ?? "Erreur.");
      return;
    }
    setPromotions((prev) => [
      {
        id: res.promotionId!,
        nom,
        articleId: article.id,
        articleNom: article.nom,
        prixVente: article.prixVente,
        type,
        valeur: v,
        dateDebut,
        dateFin,
        actif: true,
      },
      ...prev,
    ]);
    fermerDrawer();
  }

  async function handleRetirer(id: number) {
    setPromotions((prev) => prev.map((p) => (p.id === id ? { ...p, actif: false } : p)));
    await retirerPromotion(id);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-foreground">Promotions ({promotions.filter((p) => p.actif).length} active{promotions.filter((p) => p.actif).length > 1 ? "s" : ""})</div>
        <Button size="sm" onClick={() => setDrawerOpen(true)}>+ Nouvelle promotion</Button>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {promotions.map((p) => (
          <div key={p.id} className={`rounded-md border border-border bg-card p-3 ${!p.actif ? "opacity-50" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-foreground">{p.nom} — {p.articleNom}</div>
                <div className="text-xs text-muted-foreground">
                  {fmt(p.prixVente)} → <span className="font-semibold text-primary">{fmt(prixPromo(p))}</span>
                  {" "}({p.type === "POURCENTAGE" ? `-${p.valeur}%` : `-${fmt(p.valeur)}`}) · {p.dateDebut} → {p.dateFin}
                </div>
              </div>
              {p.actif && (
                <button onClick={() => handleRetirer(p.id)} className="text-xs text-destructive">Retirer</button>
              )}
            </div>
          </div>
        ))}
        {promotions.length === 0 && <p className="text-sm text-muted-foreground">Aucune promotion pour l&apos;instant.</p>}
      </div>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 flex justify-end bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) fermerDrawer();
          }}
        >
          <div className="h-full w-full max-w-md overflow-y-auto bg-background p-6 shadow-xl">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-foreground">Nouvelle promotion</h2>
              <button onClick={fermerDrawer} className="text-xl leading-none text-muted-foreground" aria-label="Fermer">
                &times;
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <ChampLabel label="Nom de la promotion">
                <Input placeholder="Ex. Soldes fin d'année" value={nom} onChange={(e) => setNom(e.target.value)} />
              </ChampLabel>

              <ChampLabel label="Article (doit être publié en boutique)">
                <select value={articleId} onChange={(e) => setArticleId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                  <option value="">Choisir un article...</option>
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>{a.nom} — {fmt(a.prixVente)}</option>
                  ))}
                </select>
              </ChampLabel>

              <div className="grid grid-cols-2 gap-3">
                <ChampLabel label="Type de réduction">
                  <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="POURCENTAGE">Pourcentage (%)</option>
                    <option value="MONTANT_FIXE">Montant fixe (F)</option>
                  </select>
                </ChampLabel>
                <ChampLabel label={type === "POURCENTAGE" ? "Valeur (%)" : "Valeur (FCFA)"}>
                  <Input type="number" placeholder={type === "POURCENTAGE" ? "Ex. 20" : "Ex. 2000"} value={valeur} onChange={(e) => setValeur(e.target.value)} />
                </ChampLabel>
              </div>

              {previewValide && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                  <span className="text-muted-foreground">Prix actuel {fmt(articleChoisi!.prixVente)} → prix promo </span>
                  <span className="font-semibold text-primary">{fmt(prixApres!)}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <ChampLabel label="Du">
                  <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
                </ChampLabel>
                <ChampLabel label="Au">
                  <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
                </ChampLabel>
              </div>

              {erreur && <p className="text-sm text-destructive" role="alert">{erreur}</p>}

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={fermerDrawer}>Annuler</Button>
                <Button onClick={handleAjouter} disabled={pending}>{pending ? "Création..." : "Créer la promotion"}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BanniereTab({ initialMessage, initialActive }: { initialMessage: string; initialActive: boolean }) {
  const [message, setMessage] = useState(initialMessage);
  const [active, setActive] = useState(initialActive);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSave() {
    setPending(true);
    await definirBanniere(message, active);
    setPending(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        Message affiché en haut de /boutique — soldes, nouveauté, annonce saisonnière.
      </p>
      <Input placeholder="ex. Soldes de fin d'année — jusqu'à -20% sur une sélection" value={message} onChange={(e) => setMessage(e.target.value)} />
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Afficher la bannière sur la boutique
      </label>
      <Button onClick={handleSave} disabled={pending} className="mt-3">
        {saved ? "Enregistré ✓" : pending ? "..." : "Enregistrer"}
      </Button>
    </div>
  );
}
