import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { buildShellModules } from "@/lib/shell-modules";
import { chargerUtilisateurAffiche } from "@/lib/session-user";
import { chargerDonneesMaquette } from "../maquette/actions";
import { MaquetteAdminClient } from "./maquette-admin-client";

// Réservé Admin/Super Admin — pas de module dédié dans la matrice de permissions (§6/§7),
// même logique que /fournisseurs ou la bibliothèque R&D (§10bis) : config système, pas une
// vente. Volontairement une route à part de /maquette (public) plutôt qu'un bouton caché
// dessus — un vrai contrôle de session, pas juste une icône discrète (retour du 2026-07-30).
export default async function MaquetteAdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.roleCode)) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès aux paramètres du parcours maquette.</p>
      </main>
    );
  }
  const [donnees, user] = await Promise.all([chargerDonneesMaquette(), chargerUtilisateurAffiche(session.userId)]);
  return (
    <MaquetteAdminClient
      userName={user.nom}
      roleLibelle={user.roleLibelle}
      modules={buildShellModules(session.roleCode)}
      donnees={donnees}
    />
  );
}
