import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { generateRapportPdf } from "@/lib/documents";
import { chargerRapportDocumentData } from "@/app/rapports/actions";

// Génère le PDF "Rapport officiel" archivé pour un mois donné (2026-08-09) — recalculé à la
// demande depuis les données réelles (même philosophie que le reste de Rapports : "toujours
// recalculé, jamais saisi à la main"), pas de snapshot stocké en base. Un mois passé donne donc
// toujours le même résultat tant que les données sous-jacentes ne sont pas corrigées a posteriori.
// Même données que l'aperçu HTML côté client (chargerRapportDocumentData) — un seul calcul, deux
// présentations (aperçu à l'écran, PDF via "Imprimer").
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ annee: string; mois: string }> }
) {
  const session = await getSession();
  if (!session || !hasModuleAccess(session.roleCode, "Rapports")) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { annee, mois } = await params;
  const anneeNum = Number(annee);
  const moisNum = Number(mois);
  if (!Number.isInteger(anneeNum) || !Number.isInteger(moisNum) || moisNum < 1 || moisNum > 12) {
    return NextResponse.json({ error: "Période invalide." }, { status: 400 });
  }

  const data = await chargerRapportDocumentData(anneeNum, moisNum);
  const { buffer } = await generateRapportPdf(data);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Rapport-EVOLUTIS223-${anneeNum}-${String(moisNum).padStart(2, "0")}.pdf"`,
    },
  });
}
