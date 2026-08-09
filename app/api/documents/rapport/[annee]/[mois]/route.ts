import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { generateRapportPdf } from "@/lib/documents";
import {
  chargerRapportFinance,
  chargerRapportOperations,
  chargerRapportRh,
  chargerTendanceFinance,
} from "@/app/rapports/actions";

const MOIS_LONGS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// Génère le PDF "Rapport officiel" archivé pour un mois donné (2026-08-09) — recalculé à la
// demande depuis les données réelles (même philosophie que le reste de Rapports : "toujours
// recalculé, jamais saisi à la main"), pas de snapshot stocké en base. Un mois passé donne donc
// toujours le même résultat tant que les données sous-jacentes ne sont pas corrigées a posteriori.
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

  const reference = new Date(anneeNum, moisNum - 1, 15); // milieu du mois — évite tout effet de bord de fuseau sur le 1er/dernier jour
  const [finance, rh, operations, tendance] = await Promise.all([
    chargerRapportFinance("MOIS", reference),
    chargerRapportRh("MOIS", reference),
    chargerRapportOperations("MOIS", reference),
    chargerTendanceFinance("MOIS", 6, reference),
  ]);

  const periodeLabel = `${MOIS_LONGS[moisNum - 1]} ${anneeNum}`;

  const { buffer } = await generateRapportPdf({
    periodeLabel,
    dateEmission: new Date(),
    finance: {
      chiffreAffaires: finance.chiffreAffaires,
      coutAchatVentes: finance.coutAchatVentes,
      beneficeBrut: finance.beneficeBrut,
      depensesCharges: finance.depensesCharges,
      commissions: finance.commissions,
      beneficeNet: finance.beneficeNet,
      nombreVentes: finance.nombreVentes,
      variationCaPct: finance.variationCaPct,
      variationBeneficeNetPct: finance.variationBeneficeNetPct,
    },
    rh: {
      effectifActif: rh.effectifActif,
      masseSalariale: rh.masseSalariale,
      variationMassePct: rh.variationMassePct,
      incidents: rh.incidents,
      besoinsActifs: rh.besoinsActifs.map((b) => ({
        titre: b.titre,
        nombrePersonnesRequis: b.nombrePersonnesRequis,
        periodeDebut: b.periodeDebut,
        periodeFin: b.periodeFin,
      })),
    },
    operations: {
      totalLivraisons: operations.totalLivraisons,
      livraisonsParStatut: operations.livraisonsParStatut,
      ruptureActuelle: operations.ruptureActuelle,
      stockFaibleActuel: operations.stockFaibleActuel,
    },
    tendance,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Rapport-EVOLUTIS223-${anneeNum}-${String(moisNum).padStart(2, "0")}.pdf"`,
    },
  });
}
