import { db } from "@/db";
import { journalAudit } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = typeof db | Tx;

export async function enregistrerAudit(
  tx: DbOrTx,
  params: {
    tableCible: string;
    enregistrementId: number;
    action: "CREATION" | "MODIFICATION" | "SUPPRESSION" | "VALIDATION";
    utilisateurId: number;
    details?: Record<string, unknown>;
  }
) {
  await tx.insert(journalAudit).values({
    tableCible: params.tableCible,
    enregistrementId: params.enregistrementId,
    action: params.action,
    utilisateurId: params.utilisateurId,
    details: params.details ?? null,
  });
}
