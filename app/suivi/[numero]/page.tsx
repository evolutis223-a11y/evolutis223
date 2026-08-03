import { eq } from "drizzle-orm";
import { db } from "@/db";
import { affaires, clients, livraisons } from "@/db/schema";

// Suivi de commande public (§11) — sans connexion, atteignable via le numéro (porté par le QR
// code sur les documents, cf. §4.9 qr_payload). Statut d'avancement uniquement, aucune donnée
// interne (pas de PMP, pas de coût, pas de détail de lignes au-delà du total déjà accepté).

const ETAPES = [
  { id: "RECUE", label: "Reçue" },
  { id: "PREPARATION", label: "En préparation" },
  { id: "LIVRAISON_RETRAIT", label: "En livraison / prête au retrait" },
  { id: "TERMINEE", label: "Livrée / retirée" },
] as const;

function formatFcfa(v: string | number) {
  return `${Math.round(Number(v)).toLocaleString("fr-FR")} FCFA`;
}

function etapeActuelle(
  affaire: { statut: string; modeFinalisation: string | null },
  livraison: { statut: string } | null
): { idx: number; label: string } | { annulee: true } {
  if (affaire.statut === "ANNULEE") return { annulee: true };
  if (affaire.statut === "EN_ATTENTE") return { idx: 0, label: ETAPES[0].label };
  if (affaire.statut === "CLOTUREE") {
    return { idx: 3, label: affaire.modeFinalisation === "LIVRAISON" ? "Livrée" : "Retirée" };
  }
  // VALIDEE (ou vente comptoir direct, rarement observée à ce stade)
  if (affaire.modeFinalisation === "LIVRAISON") {
    if (livraison?.statut === "EN_ROUTE") return { idx: 2, label: "En livraison" };
    if (livraison?.statut === "PRIS_EN_CHARGE") return { idx: 1, label: "Prise en charge par le livreur" };
    return { idx: 1, label: ETAPES[1].label };
  }
  if (affaire.modeFinalisation === "RETRAIT") return { idx: 2, label: "Prête pour retrait" };
  return { idx: 1, label: ETAPES[1].label };
}

export default async function SuiviPage({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params;

  const [affaire] = await db
    .select({
      id: affaires.id,
      numero: affaires.numero,
      type: affaires.type,
      statut: affaires.statut,
      modeFinalisation: affaires.modeFinalisation,
      montantTtc: affaires.montantTtc,
      dateCreation: affaires.dateCreation,
      clientNom: clients.nom,
    })
    .from(affaires)
    .innerJoin(clients, eq(clients.id, affaires.clientId))
    .where(eq(affaires.numero, decodeURIComponent(numero)))
    .limit(1);

  if (!affaire) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-lg font-semibold text-foreground">Commande introuvable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vérifiez le numéro — il doit correspondre exactement à celui indiqué sur votre document.
        </p>
      </main>
    );
  }

  if (!["COMMANDE_ATTENTE", "TICKET", "FACTURE"].includes(affaire.type)) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-lg font-semibold text-foreground">Suivi non disponible</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ce document ({affaire.numero}) n&apos;est pas une commande suivie ici.
        </p>
      </main>
    );
  }

  const [livraison] = affaire.modeFinalisation === "LIVRAISON"
    ? await db.select().from(livraisons).where(eq(livraisons.affaireId, affaire.id)).limit(1)
    : [];

  const etape = etapeActuelle(affaire, livraison ?? null);

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="text-center">
        <div className="font-mono text-xs text-muted-foreground">EVOLUTIS223</div>
        <h1 className="mt-1 text-xl font-bold text-foreground">{affaire.numero}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{affaire.clientNom}</p>
      </div>

      {"annulee" in etape ? (
        <div className="mt-8 rounded-lg border border-rose-200 bg-rose-50 p-4 text-center text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          Cette commande a été annulée.
        </div>
      ) : (
        <div className="mt-8">
          <div className="flex items-center">
            {ETAPES.map((e, i) => (
              <div key={e.id} className="flex flex-1 items-center last:flex-none">
                <div
                  className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-bold ${
                    i <= etape.idx
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                {i < ETAPES.length - 1 && (
                  <div className={`h-0.5 flex-1 ${i < etape.idx ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[11px] text-muted-foreground">
            {ETAPES.map((e, i) => (
              <span key={e.id} className={i === etape.idx ? "font-semibold text-foreground" : ""}>
                {e.label}
              </span>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-border bg-card p-4 text-center">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Statut actuel</div>
            <div className="mt-1 text-base font-semibold text-foreground">{etape.label}</div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between rounded-lg border border-border p-4 text-sm">
        <span className="text-muted-foreground">Montant total</span>
        <span className="font-semibold tabular-nums text-foreground">{formatFcfa(affaire.montantTtc)}</span>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Une question sur votre commande ? Contactez-nous en mentionnant le numéro {affaire.numero}.
      </p>
    </main>
  );
}
