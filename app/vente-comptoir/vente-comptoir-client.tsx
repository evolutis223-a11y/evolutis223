"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  encaisserVenteComptoir,
  type CatalogueComptoirArticle,
  type CatalogueComptoirVariante,
  type VenteComptoirLigne,
} from "./actions";

type Catalogue = { articles: CatalogueComptoirArticle[]; variantes: CatalogueComptoirVariante[] };
type Panier = (VenteComptoirLigne & { nom: string; label: string })[];
type VenteEnAttente = {
  id: string;
  nomClient: string;
  telephoneClient: string;
  lignes: VenteComptoirLigne[];
  resume: string;
  createdAt: string;
  erreur?: string;
};

const CACHE_KEY = "evolutis223_comptoir_catalogue";
const QUEUE_KEY = "evolutis223_comptoir_file_attente";

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

function lireCache(): (Catalogue & { savedAt: string }) | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function ecrireCache(catalogue: Catalogue) {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ...catalogue, savedAt: new Date().toISOString() }));
}
function lireFile(): VenteEnAttente[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function ecrireFile(file: VenteEnAttente[]) {
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(file));
}

export function VenteComptoirClient({ initialCatalogue }: { initialCatalogue: Catalogue }) {
  const [enLigne, setEnLigne] = useState(true);
  const [catalogue, setCatalogue] = useState<Catalogue & { savedAt?: string }>(initialCatalogue);
  const [file, setFile] = useState<VenteEnAttente[]>([]);
  const [synchronisation, setSynchronisation] = useState(false);

  const [articleId, setArticleId] = useState("");
  const [varianteId, setVarianteId] = useState("");
  const [quantite, setQuantite] = useState("1");
  const [panier, setPanier] = useState<Panier>([]);
  const [nomClient, setNomClient] = useState("");
  const [telephoneClient, setTelephoneClient] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  // Au montage : catalogue frais si en ligne (et on le mémorise), sinon on retombe sur le cache.
  useEffect(() => {
    ecrireCache(initialCatalogue);
    setFile(lireFile());
    setEnLigne(navigator.onLine);
    if (!navigator.onLine) {
      const cache = lireCache();
      if (cache) setCatalogue(cache);
    }

    function onOnline() {
      setEnLigne(true);
    }
    function onOffline() {
      setEnLigne(false);
      const cache = lireCache();
      if (cache) setCatalogue(cache);
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dès que la connexion revient, on vide la file d'attente automatiquement.
  useEffect(() => {
    if (!enLigne) return;
    const enAttente = lireFile();
    if (enAttente.length === 0) return;
    (async () => {
      setSynchronisation(true);
      const restantes: VenteEnAttente[] = [];
      for (const vente of enAttente) {
        const res = await encaisserVenteComptoir(vente.nomClient, vente.telephoneClient, vente.lignes);
        if (res.error) {
          restantes.push({ ...vente, erreur: res.error });
        }
      }
      ecrireFile(restantes);
      setFile(restantes);
      setSynchronisation(false);
    })();
  }, [enLigne]);

  const variantesArticle = catalogue.variantes.filter((v) => v.articleId === Number(articleId));
  const article = catalogue.articles.find((a) => a.id === Number(articleId));
  const variante = variantesArticle.find((v) => v.id === Number(varianteId));

  function ajouterAuPanier() {
    if (!article || !variante) {
      setErreur("Choisissez un article et une taille/couleur.");
      return;
    }
    const qte = Number(quantite);
    if (!Number.isFinite(qte) || qte <= 0) {
      setErreur("Quantité invalide.");
      return;
    }
    setErreur(null);
    const label = [variante.taille, variante.couleur].filter(Boolean).join(" ") || "Défaut";
    setPanier((prev) => [
      ...prev,
      { articleId: article.id, varianteId: variante.id, quantite: qte, prixUnitaire: article.prixVente, nom: article.nom, label },
    ]);
    setVarianteId("");
    setQuantite("1");
  }

  function retirerDuPanier(i: number) {
    setPanier((prev) => prev.filter((_, idx) => idx !== i));
  }

  const total = panier.reduce((acc, l) => acc + l.quantite * l.prixUnitaire, 0);

  async function handleEncaisser() {
    if (!nomClient.trim() || !telephoneClient.trim()) {
      setErreur("Nom et téléphone du client requis.");
      return;
    }
    if (panier.length === 0) {
      setErreur("Le panier est vide.");
      return;
    }
    setErreur(null);
    setSucces(null);

    const lignes: VenteComptoirLigne[] = panier.map((p) => ({
      articleId: p.articleId,
      varianteId: p.varianteId,
      quantite: p.quantite,
      prixUnitaire: p.prixUnitaire,
    }));

    if (!enLigne) {
      const vente: VenteEnAttente = {
        id: `local-${Date.now()}`,
        nomClient: nomClient.trim(),
        telephoneClient: telephoneClient.trim(),
        lignes,
        resume: panier.map((p) => `${p.nom} (${p.label}) ×${p.quantite}`).join(", "),
        createdAt: new Date().toISOString(),
      };
      const nouvelleFile = [...lireFile(), vente];
      ecrireFile(nouvelleFile);
      setFile(nouvelleFile);
      setSucces("Hors ligne — vente mise en attente, elle sera envoyée automatiquement à la reconnexion.");
      setPanier([]);
      setNomClient("");
      setTelephoneClient("");
      return;
    }

    setEnvoi(true);
    const res = await encaisserVenteComptoir(nomClient.trim(), telephoneClient.trim(), lignes);
    setEnvoi(false);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    setSucces(`Vente encaissée — affaire créée.`);
    setPanier([]);
    setNomClient("");
    setTelephoneClient("");
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Poste de vente comptoir</h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${enLigne ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"}`}
        >
          {enLigne ? "En ligne" : "Hors ligne"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Résiste aux coupures internet momentanées (§3.3) — le catalogue reste utilisable, les ventes sont mises en
        attente et envoyées automatiquement dès la reconnexion.
      </p>

      {file.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {synchronisation ? "Synchronisation en cours..." : `${file.length} vente(s) en attente d'envoi.`}
          <ul className="mt-1 list-disc pl-4 text-xs">
            {file.map((v) => (
              <li key={v.id}>
                {v.resume} — {v.nomClient} {v.erreur && <span className="text-destructive">({v.erreur})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!enLigne && catalogue.savedAt && (
        <p className="mt-2 text-xs text-muted-foreground">
          Catalogue en cache — dernière mise à jour {new Date(catalogue.savedAt).toLocaleString("fr-FR")}.
        </p>
      )}

      <div className="mt-4 rounded-md border border-border bg-card p-4">
        <div className="grid grid-cols-2 gap-2">
          <select
            value={articleId}
            onChange={(e) => {
              setArticleId(e.target.value);
              setVarianteId("");
            }}
            className="col-span-2 h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Choisir un article...</option>
            {catalogue.articles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom} — {fmt(a.prixVente)}
              </option>
            ))}
          </select>
          {article && (
            <select
              value={varianteId}
              onChange={(e) => setVarianteId(e.target.value)}
              className="col-span-2 h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Taille / couleur...</option>
              {variantesArticle.map((v) => (
                <option key={v.id} value={v.id} disabled={v.stockDetail <= 0}>
                  {[v.taille, v.couleur].filter(Boolean).join(" ") || "Défaut"} — dispo {v.stockDetail}
                  {v.stockDetail <= 0 ? " (rupture)" : ""}
                </option>
              ))}
            </select>
          )}
          <Input type="number" min={1} value={quantite} onChange={(e) => setQuantite(e.target.value)} placeholder="Qté" />
          <Button variant="outline" onClick={ajouterAuPanier}>
            + Ajouter au panier
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          {panier.map((l, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-2 text-sm">
              <span className="text-foreground">
                {l.nom} ({l.label}) ×{l.quantite}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-foreground">{fmt(l.quantite * l.prixUnitaire)}</span>
                <button onClick={() => retirerDuPanier(i)} className="text-xs text-destructive">
                  Retirer
                </button>
              </div>
            </div>
          ))}
          {panier.length === 0 && <p className="text-xs text-muted-foreground">Panier vide.</p>}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-bold text-foreground">{fmt(total)}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Input placeholder="Nom du client" value={nomClient} onChange={(e) => setNomClient(e.target.value)} />
          <Input placeholder="Téléphone" value={telephoneClient} onChange={(e) => setTelephoneClient(e.target.value)} />
        </div>

        {erreur && <p className="mt-2 text-xs text-destructive">{erreur}</p>}
        {succes && <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{succes}</p>}

        <Button onClick={handleEncaisser} disabled={envoi} className="mt-3 w-full">
          {envoi ? "Envoi..." : enLigne ? "Encaisser" : "Encaisser (hors ligne — mise en attente)"}
        </Button>
      </div>
    </main>
  );
}
