import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { articles, clients, variantes, vStockVariante } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { buildShellModules } from "@/lib/shell-modules";
import { chargerUtilisateurAffiche } from "@/lib/session-user";
import { chargerBibliotheque, chargerModelesPrets, chargerParametresMarquage } from "./actions";
import { RdCalculateursClient } from "./rd-calculateurs-client";

export default async function RdCalculateursPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "R&D")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès au module R&amp;D.</p>
      </main>
    );
  }

  const [articleRows, varianteRows, clientRows, biblio, parametres, modelesPrets] = await Promise.all([
    db.select().from(articles).where(eq(articles.famille, "A")),
    db
      .select({
        id: variantes.id,
        articleId: variantes.articleId,
        taille: variantes.taille,
        couleur: variantes.couleur,
        stockDetail: vStockVariante.stockDetail,
      })
      .from(variantes)
      .leftJoin(vStockVariante, eq(vStockVariante.varianteId, variantes.id)),
    db.select().from(clients).orderBy(clients.nom),
    chargerBibliotheque(),
    chargerParametresMarquage(),
    chargerModelesPrets(),
  ]);

  const user = await chargerUtilisateurAffiche(session.userId);

  return (
    <RdCalculateursClient
      userName={user.nom}
      roleLibelle={user.roleLibelle}
      modules={buildShellModules(session.roleCode)}
      articles={articleRows}
      variantes={varianteRows}
      clients={clientRows}
      biblio={biblio}
      parametres={parametres}
      modelesPrets={modelesPrets}
      isAdmin={["ADMIN", "SUPER_ADMIN"].includes(session.roleCode)}
    />
  );
}
