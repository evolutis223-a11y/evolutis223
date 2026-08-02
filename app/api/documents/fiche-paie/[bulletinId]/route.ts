import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bulletinsPaie, personnel } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { generateFichePaiePdf, type RubriquePaie } from "@/lib/documents";

const TYPE_LABELS: Record<string, string> = { SALARIE: "Salarié", JOURNALIER: "Journalier", PARTENAIRE: "Partenaire" };

// Génère et sert le PDF de la Fiche de paie à la volée pour un bulletin donné (§13). Pas de
// persistance dans documentsArchives — même choix assumé que le Bon de livraison en attendant
// que le stockage de fichiers soit tranché pour cet usage (§16).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bulletinId: string }> }
) {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "RH")) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { bulletinId } = await params;
  const id = Number(bulletinId);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  const [bulletin] = await db
    .select({
      id: bulletinsPaie.id,
      periode: bulletinsPaie.periode,
      salaireBase: bulletinsPaie.salaireBase,
      primeTransport: bulletinsPaie.primeTransport,
      commission: bulletinsPaie.commission,
      retenueInps: bulletinsPaie.retenueInps,
      avance: bulletinsPaie.avance,
      netAPayer: bulletinsPaie.netAPayer,
      personnelId: bulletinsPaie.personnelId,
      personnelNom: personnel.nom,
      personnelFonction: personnel.fonction,
      typeContrat: personnel.typeContrat,
    })
    .from(bulletinsPaie)
    .innerJoin(personnel, eq(personnel.id, bulletinsPaie.personnelId))
    .where(eq(bulletinsPaie.id, id))
    .limit(1);

  if (!bulletin) {
    return NextResponse.json({ error: "Bulletin introuvable." }, { status: 404 });
  }

  const rubriques: RubriquePaie[] = [
    { designation: "Salaire de base", montant: Number(bulletin.salaireBase) },
    { designation: "Prime de transport", montant: Number(bulletin.primeTransport) },
    { designation: "Commission", montant: Number(bulletin.commission) },
    { designation: "Retenue INPS", montant: -Number(bulletin.retenueInps) },
    { designation: "Avance déjà versée", montant: -Number(bulletin.avance) },
  ].filter((r) => r.montant !== 0);

  const numero = `PAIE-${bulletin.periode}-${String(bulletin.personnelId).padStart(4, "0")}`;

  const { buffer } = await generateFichePaiePdf({
    numero,
    periode: bulletin.periode,
    employeNom: bulletin.personnelNom,
    employeFonction: bulletin.personnelFonction ?? undefined,
    typeContrat: TYPE_LABELS[bulletin.typeContrat] ?? bulletin.typeContrat,
    rubriques,
    netAPayer: Number(bulletin.netAPayer),
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${numero}.pdf"`,
    },
  });
}
