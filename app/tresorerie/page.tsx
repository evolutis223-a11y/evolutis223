import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { bonsDecaissement, cloturesCaisse, parametresTresorerie, utilisateurs } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { calculerSoldeTheorique } from "./actions";
import { TresorerieClient } from "./tresorerie-client";

export default async function TresoreriePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Trésorerie")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès au module Trésorerie.</p>
      </main>
    );
  }

  const [bons, clotures, soldeTheoriqueAujourdhui, utilisateursRows, parametres] = await Promise.all([
    db.select().from(bonsDecaissement).orderBy(desc(bonsDecaissement.id)),
    db.select().from(cloturesCaisse).orderBy(desc(cloturesCaisse.dateCloture)),
    calculerSoldeTheorique(new Date()),
    db.select().from(utilisateurs),
    db.select().from(parametresTresorerie).limit(1),
  ]);

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const clotureAujourdhui = clotures.find((c) => c.dateCloture === aujourdhui);

  return (
    <TresorerieClient
      bons={bons}
      clotures={clotures}
      utilisateurs={utilisateursRows}
      soldeTheoriqueAujourdhui={soldeTheoriqueAujourdhui}
      clotureAujourdhuiExiste={Boolean(clotureAujourdhui)}
      seuilValidation={parametres[0] ? Number(parametres[0].seuilValidationDecaissement) : 50000}
      currentUserId={session.userId}
      isAdmin={["ADMIN", "SUPER_ADMIN"].includes(session.roleCode)}
    />
  );
}
