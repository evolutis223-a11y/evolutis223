import { redirect } from "next/navigation";
import { db } from "@/db";
import { articles, variantes } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { buildShellModules } from "@/lib/shell-modules";
import { chargerUtilisateurAffiche } from "@/lib/session-user";
import { chargerDonneesCommerciales } from "./actions";
import { CommercialClient } from "./commercial-client";

export default async function CommercialPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Commercial")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès au module Commercial.</p>
      </main>
    );
  }

  const [articleRows, varianteRows, donnees, user] = await Promise.all([
    db.select().from(articles).orderBy(articles.nom),
    db.select().from(variantes),
    chargerDonneesCommerciales(),
    chargerUtilisateurAffiche(session.userId),
  ]);

  return (
    <CommercialClient
      userName={user.nom}
      roleLibelle={user.roleLibelle}
      modules={buildShellModules(session.roleCode)}
      articles={articleRows}
      variantes={varianteRows}
      isRespCommercial={session.roleCode === "RESP_COMMERCIAL"}
      {...donnees}
    />
  );
}
