import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { buildShellModules } from "@/lib/shell-modules";
import { chargerUtilisateurAffiche } from "@/lib/session-user";
import { AppShell } from "@/components/app-shell";

const MOIS_LONGS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// Archive des rapports mensuels (2026-08-09) — pas de table de snapshot : chaque mois listé ici
// génère son PDF à la demande via /api/documents/rapport/[annee]/[mois], toujours recalculé
// depuis les données réelles au moment du téléchargement (même philosophie que le reste de
// Rapports). 24 derniers mois listés par défaut — suffisant pour un usage bancaire/partenariat,
// pas besoin de savoir la date de création de l'entreprise pour borner la liste.
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
  const mois = derniersMois(24);

  return (
    <AppShell userName={user.nom} roleLibelle={user.roleLibelle} pageTitle="Archive des rapports" modules={buildShellModules(session.roleCode)}>
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Archive des rapports</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Un document PDF officiel par mois — en-tête, mentions légales, prêt pour une banque ou un partenaire.
            </p>
          </div>
          <a href="/rapports" className="text-sm text-muted-foreground hover:underline">
            ← Rapports
          </a>
        </div>

        <div className="overflow-hidden rounded-md border border-border">
          {mois.map(({ annee, mois: m }, i) => (
            <a
              key={`${annee}-${m}`}
              href={`/api/documents/rapport/${annee}/${m}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-between px-4 py-3 text-sm hover:bg-muted ${i !== mois.length - 1 ? "border-b border-border" : ""}`}
            >
              <span className="font-medium text-foreground">
                {MOIS_LONGS[m - 1]} {annee}
              </span>
              <span className="text-xs font-semibold text-primary">📄 Télécharger le PDF</span>
            </a>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
