import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { buildShellModules } from "@/lib/shell-modules";
import { chargerUtilisateurAffiche } from "@/lib/session-user";
import { RapportArchiveClient } from "./archive-client";

// Archive des rapports mensuels (2026-08-09) — pas de table de snapshot : chaque mois listé ici
// génère son aperçu/PDF à la demande, toujours recalculé depuis les données réelles (même
// philosophie que le reste de Rapports). 24 derniers mois listés par défaut.
function derniersMois(nombre: number): { annee: number; mois: number }[] {
  const maintenant = new Date();
  const liste: { annee: number; mois: number }[] = [];
  for (let i = 0; i < nombre; i++) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    liste.push({ annee: d.getFullYear(), mois: d.getMonth() + 1 });
  }
  return liste;
}

export default async function RapportArchivePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Rapports")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès aux rapports.</p>
      </main>
    );
  }
  const user = await chargerUtilisateurAffiche(session.userId);

  return (
    <RapportArchiveClient
      userName={user.nom}
      roleLibelle={user.roleLibelle}
      modules={buildShellModules(session.roleCode)}
      mois={derniersMois(24)}
    />
  );
}
