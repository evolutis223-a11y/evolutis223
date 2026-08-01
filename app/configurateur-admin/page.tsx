import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { chargerDonneesConfigurateur } from "../configurateur/actions";
import { ConfigurateurAdminClient } from "./configurateur-admin-client";

// Réservé Admin/Super Admin — pas de module dédié dans la matrice de permissions (§6/§7), même
// logique que /maquette-admin : config système (galerie de modèles, finitions), pas une vente.
// Route à part de /configurateur (public), un vrai contrôle de session.
export default async function ConfigurateurAdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.roleCode)) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès aux paramètres du configurateur.</p>
      </main>
    );
  }
  const donnees = await chargerDonneesConfigurateur();
  return (
    <ConfigurateurAdminClient
      modeles={donnees.modeles}
      finitions={donnees.finitions}
      articles={donnees.articles.map((a) => ({ id: a.id, nom: a.nom, code: a.code }))}
    />
  );
}
