import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { utilisateurs, roles } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { modulesForRole, type ModuleName } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { logout } from "./actions";

// Routes réellement construites — les autres modules restent des tuiles non cliquables
// tant que leur page n'existe pas.
const MODULE_ROUTES: Partial<Record<ModuleName, string>> = {
  Catalogue: "/catalogue",
  Stocks: "/stocks",
  Clients: "/clients",
  Affaires: "/affaires",
  Commandes: "/commandes",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [user] = await db
    .select({
      nom: utilisateurs.nom,
      roleLibelle: roles.libelle,
      roleCode: roles.code,
    })
    .from(utilisateurs)
    .innerJoin(roles, eq(utilisateurs.roleId, roles.id))
    .where(eq(utilisateurs.id, session.userId))
    .limit(1);

  if (!user) redirect("/login");

  const modules = modulesForRole(user.roleCode);

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">EVOLUTIS223</h1>
            <p className="text-sm text-muted-foreground">
              {user.nom} — {user.roleLibelle}
            </p>
          </div>
          <form action={logout}>
            <Button variant="outline" type="submit">
              Se déconnecter
            </Button>
          </form>
        </header>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Modules accessibles à ce rôle ({modules.length})
          </h2>
          {modules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun module — ce rôle n&apos;a pas de compte applicatif prévu.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {modules.map((m) => {
                const href = MODULE_ROUTES[m];
                const className =
                  "rounded-md border border-border bg-card px-3 py-2 text-sm text-card-foreground" +
                  (href ? " hover:bg-muted/60" : " opacity-60");
                return href ? (
                  <Link key={m} href={href} className={className}>
                    {m}
                  </Link>
                ) : (
                  <div key={m} className={className}>
                    {m}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
