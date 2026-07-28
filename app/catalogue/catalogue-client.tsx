"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { articles, branches } from "@/db/schema";
import { createArticle, togglePublieBoutique, type CreateArticleState } from "./actions";
import { FAMILLES, FamilleIcon, familleMeta, type FamilleId } from "./familles";

type Article = typeof articles.$inferSelect;
type Branche = typeof branches.$inferSelect;

function formatFcfa(value: string | number): string {
  return `${Math.round(Number(value)).toLocaleString("fr-FR")} F`;
}

function Thumb({ article, className }: { article: Article; className?: string }) {
  const meta = familleMeta(article.famille);
  if (article.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={article.photoUrl} alt={article.nom} className={`object-cover ${className ?? ""}`} />;
  }
  return (
    <div className={`flex items-center justify-center ${meta.tileClass} ${className ?? ""}`}>
      <FamilleIcon id={article.famille as FamilleId} className="h-1/2 w-1/2" />
    </div>
  );
}

function FamilleBadge({ famille }: { famille: string }) {
  const meta = familleMeta(famille);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.badgeClass}`}>
      {meta.short}
    </span>
  );
}

const initialCreateState: CreateArticleState = { error: null };

export function CatalogueClient({
  articles: initialArticles,
  branches,
}: {
  articles: Article[];
  branches: Branche[];
}) {
  const brancheNom = (id: number | null) => branches.find((b) => b.id === id)?.nom ?? null;
  const [activeFamille, setActiveFamille] = useState<FamilleId | "TOUS">("TOUS");
  const [detailArticle, setDetailArticle] = useState<Article | null>(null);
  const [hover, setHover] = useState<{ article: Article; top: number; left: number } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFamille, setDrawerFamille] = useState<FamilleId | null>(null);
  const [codeSuffix, setCodeSuffix] = useState("");
  const [createState, createAction, pending] = useActionState(createArticle, initialCreateState);
  const [formKey, setFormKey] = useState(0);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !createState.error) {
      setDrawerOpen(false);
      setFormKey((k) => k + 1);
      setDrawerFamille(null);
      setCodeSuffix("");
    }
    wasPending.current = pending;
  }, [pending, createState.error]);

  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const byFamille =
      activeFamille === "TOUS"
        ? initialArticles
        : initialArticles.filter((a) => a.famille === activeFamille);
    const q = search.trim().toLowerCase();
    if (!q) return byFamille;
    return byFamille.filter(
      (a) => a.code.toLowerCase().includes(q) || a.nom.toLowerCase().includes(q)
    );
  }, [initialArticles, activeFamille, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { TOUS: initialArticles.length };
    for (const f of FAMILLES) c[f.id] = initialArticles.filter((a) => a.famille === f.id).length;
    return c;
  }, [initialArticles]);

  function handleRowEnter(e: React.MouseEvent<HTMLDivElement>, article: Article) {
    const rect = e.currentTarget.getBoundingClientRect();
    let left = rect.right + 14;
    if (left + 240 > window.innerWidth - 12) left = rect.left - 254;
    setHover({ article, top: Math.max(12, rect.top), left: Math.max(12, left) });
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Catalogue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chaque article appartient à une seule famille (§5) — elle détermine comment son stock
            est renseigné, jamais comment il est affiché ici.
          </p>
        </div>
        <Button onClick={() => setDrawerOpen(true)}>+ Nouvel article</Button>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[{ id: "TOUS" as const, short: "Tous" }, ...FAMILLES].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFamille(f.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                activeFamille === f.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              {counts[f.id] ?? 0} {f.short}
            </button>
          ))}
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par code ou nom..."
          className="w-56"
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Survolez une ligne pour un aperçu rapide, cliquez pour la fiche complète.
      </p>

      <div className="mt-2 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-3">Article</th>
              <th className="px-4 py-3">Famille</th>
              <th className="px-4 py-3">Prix de vente</th>
              <th className="px-4 py-3">Publié en ligne</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {search.trim() ? "Aucun article ne correspond à cette recherche." : "Aucun article dans cette famille."}
                </td>
              </tr>
            )}
            {filtered.map((a) => (
              <tr
                key={a.id}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                onClick={() => setDetailArticle(a)}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-11 w-11 flex-none overflow-hidden rounded-md border border-border"
                      onMouseEnter={(e) => handleRowEnter(e, a)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <Thumb article={a} className="h-full w-full" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{a.nom}</div>
                      <div className="font-mono text-xs text-muted-foreground">{a.code}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-col gap-1">
                    <FamilleBadge famille={a.famille} />
                    {brancheNom(a.brancheId) && (
                      <span className="text-[11px] text-muted-foreground">{brancheNom(a.brancheId)}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-base font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                  {formatFcfa(a.prixVente)}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePublieBoutique(a.id, !a.publieBoutique);
                      }}
                      role="switch"
                      aria-checked={a.publieBoutique}
                      className="inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors"
                      style={{
                        backgroundColor: a.publieBoutique ? "#10b981" : "var(--border)",
                      }}
                    >
                      <span
                        className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
                        style={{ transform: a.publieBoutique ? "translateX(18px)" : "translateX(2px)" }}
                      />
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {a.publieBoutique ? "Publié" : "Non publié"}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hover && (
        <div
          className="fixed z-20 w-60 rounded-md border border-border bg-popover p-3 shadow-lg"
          style={{ top: hover.top, left: hover.left }}
        >
          <div className="mb-2 h-28 w-full overflow-hidden rounded-sm border border-border">
            <Thumb article={hover.article} className="h-full w-full" />
          </div>
          <div className="text-sm font-semibold text-foreground">{hover.article.nom}</div>
          <div className="text-sm font-medium tabular-nums text-foreground">
            {formatFcfa(hover.article.prixVente)}
          </div>
          <div className="mt-1 text-xs font-medium text-primary">Cliquer pour la fiche complète →</div>
        </div>
      )}

      {detailArticle && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/45 p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailArticle(null);
          }}
        >
          <div className="w-full max-w-2xl rounded-xl bg-background shadow-xl">
            <div className="flex justify-end p-3">
              <button
                onClick={() => setDetailArticle(null)}
                className="text-xl leading-none text-muted-foreground"
                aria-label="Fermer"
              >
                &times;
              </button>
            </div>
            <div className="grid gap-6 px-6 pb-6 sm:grid-cols-[220px_1fr]">
              <div className="h-48 overflow-hidden rounded-md border border-border">
                <Thumb article={detailArticle} className="h-full w-full" />
              </div>
              <div>
                <div className="font-mono text-xs text-muted-foreground">{detailArticle.code}</div>
                <h2 className="mt-1 text-lg font-semibold text-foreground">{detailArticle.nom}</h2>
                <div className="mt-2 flex items-center gap-3">
                  <FamilleBadge famille={detailArticle.famille} />
                  {brancheNom(detailArticle.brancheId) && (
                    <span className="text-xs text-muted-foreground">
                      {brancheNom(detailArticle.brancheId)}
                    </span>
                  )}
                  <span className="text-lg font-semibold tabular-nums text-foreground">
                    {formatFcfa(detailArticle.prixVente)}
                  </span>
                </div>
                <div className="mt-4 rounded-md border-l-2 border-primary bg-muted/50 p-3 text-sm text-muted-foreground">
                  {detailArticle.famille === "E"
                    ? "Recette du kit à définir dans Stocks (Phase 1.2) — le stock sera calculé automatiquement depuis les composants."
                    : detailArticle.famille === "C" || detailArticle.famille === "D"
                      ? familleMeta(detailArticle.famille).guidance
                      : "Stock pas encore configuré — variantes, approvisionnement et lots se renseignent dans Stocks (Phase 1.2)."}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border p-4">
              <Button variant="outline" onClick={() => setDetailArticle(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 flex justify-end bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          <div className="h-full w-full max-w-md overflow-y-auto bg-background p-6 shadow-xl">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-foreground">Nouvel article</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-xl leading-none text-muted-foreground"
                aria-label="Fermer"
              >
                &times;
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Les champs propres au stock (douzaines, variantes, recette) se renseignent après
              création — ici seulement la fiche article.
            </p>

            <form
              key={formKey}
              action={(fd) => {
                if (!drawerFamille) return;
                fd.set("famille", drawerFamille);
                fd.set("code", `${drawerFamille}-${codeSuffix.trim()}`);
                createAction(fd);
              }}
              className="mt-5 space-y-4"
            >
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
                  Famille <span className="text-destructive">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {FAMILLES.map((f) => (
                    <div
                      key={f.id}
                      onClick={() => setDrawerFamille(f.id)}
                      className={`cursor-pointer rounded-md border p-2.5 text-xs ${
                        drawerFamille === f.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background"
                      }`}
                    >
                      <div className="font-semibold text-foreground">
                        {f.id} · {f.short}
                      </div>
                      <div className="mt-0.5 text-muted-foreground">{f.desc}</div>
                    </div>
                  ))}
                </div>
                {!drawerFamille && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Choisissez une famille pour continuer — elle conditionne le reste de la fiche.
                  </p>
                )}
                {drawerFamille && (
                  <div className="mt-3 rounded-md border-l-2 border-primary bg-muted/50 p-3 text-xs text-muted-foreground">
                    <b className="text-foreground">{familleMeta(drawerFamille).label} : </b>
                    {familleMeta(drawerFamille).guidance}
                  </div>
                )}
              </div>

              {drawerFamille && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                      Code
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm font-mono text-muted-foreground">
                        {drawerFamille}-
                      </span>
                      <Input
                        value={codeSuffix}
                        onChange={(e) => setCodeSuffix(e.target.value)}
                        placeholder="061"
                        required
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      L&apos;indice de famille est ajouté automatiquement au code.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                      Nom de l&apos;article
                    </label>
                    <Input name="nom" placeholder="Ex. Polo brodé Standard" required />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                      Prix de vente (F CFA)
                    </label>
                    <Input name="prixVente" type="number" min="0" step="1" placeholder="Ex. 9000" required />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                      Branche
                    </label>
                    <select
                      name="brancheId"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                      <option value="">Non catégorisé</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nom}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Catégorisation légère (§1) — pour les rapports par branche, pas pour l&apos;accès.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                      Photo (URL)
                    </label>
                    <Input name="photoUrl" placeholder="https://... (optionnel)" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Import de fichier à venir avec le stockage objet (§3.2) — une URL suffit pour l&apos;instant.
                    </p>
                  </div>
                </>
              )}

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" name="publieBoutique" className="h-4 w-4" />
                Publier sur la boutique en ligne
              </label>

              {createState.error && (
                <p className="text-sm text-destructive" role="alert">
                  {createState.error}
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={pending || !drawerFamille}>
                  {pending ? "Création..." : "Créer l'article"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
