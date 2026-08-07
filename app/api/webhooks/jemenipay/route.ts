// §12 — réception des notifications de paiement Jemenipay (Orange Money/Moov Money).
// Route publique par nature (Jemenipay n'a pas de session EVOLUTIS223) — la seule protection est
// la vérification de signature HMAC-SHA512 (lib/jemenipay.ts). Aucune donnée ne bouge sans
// signature valide.
//
// ATTENTION — noms de champs du payload non confirmés contre la doc réelle (voir lib/jemenipay.ts) :
// plusieurs alias raisonnables sont essayés (event/type, data.reference/reference...). Le corps brut
// est toujours conservé dans paiements_mobile_money.brut pour ajuster sans perte au premier vrai test.

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { affaires, paiementsMobileMoney, reglements } from "@/db/schema";
import { verifierSignatureWebhookJemenipay } from "@/lib/jemenipay";

interface PayloadJemenipay {
  event?: string;
  type?: string;
  data?: {
    id?: string;
    transaction_id?: string;
    reference?: string;
    amount?: number | string;
    phone?: string;
  };
  id?: string;
  transaction_id?: string;
  reference?: string;
  amount?: number | string;
  phone?: string;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("X-Jemeni-Signature");

  let signatureValide: boolean;
  try {
    signatureValide = verifierSignatureWebhookJemenipay(rawBody, signature);
  } catch (err) {
    // Variable d'environnement manquante — configuration incomplète, pas une faute de l'appelant.
    console.error("Webhook Jemenipay — configuration manquante :", err);
    return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });
  }
  if (!signatureValide) {
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
  }

  let payload: PayloadJemenipay;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const evenement = payload.event ?? payload.type ?? "";
  const donnees = payload.data ?? payload;
  const reference = donnees.transaction_id ?? donnees.id ?? donnees.reference;
  const montant = donnees.amount != null ? Number(donnees.amount) : null;
  const telephone = donnees.phone ?? "";

  if (!reference) {
    return NextResponse.json({ error: "Référence de transaction absente du payload." }, { status: 400 });
  }

  // Notre référence externe transmise à l'initiation (voir initierPaiementJemenipay) est le
  // numéro d'affaire — on retrouve l'affaire liée si elle existe encore (paiement "compte
  // d'attente" possible, comme pour les règlements manuels, si l'association a été perdue).
  const referenceAffaire = payload.data?.reference ?? payload.reference ?? null;
  let affaireId: number | null = null;
  if (referenceAffaire) {
    const [affaire] = await db.select({ id: affaires.id }).from(affaires).where(eq(affaires.numero, referenceAffaire)).limit(1);
    affaireId = affaire?.id ?? null;
  }

  const [existant] = await db
    .select({ id: paiementsMobileMoney.id, statut: paiementsMobileMoney.statut })
    .from(paiementsMobileMoney)
    .where(eq(paiementsMobileMoney.reference, reference))
    .limit(1);

  const estSucces = evenement === "payment.success";
  const estEchec = evenement === "payment.failed";

  if (!estSucces && !estEchec) {
    // Autre type d'événement (abonnements, etc.) — accusé de réception sans action pour l'instant.
    return NextResponse.json({ ok: true, ignore: evenement });
  }

  await db.transaction(async (tx) => {
    let paiementId: number;
    if (existant) {
      paiementId = existant.id;
      if (existant.statut !== "EN_ATTENTE") return; // déjà traité — idempotence
    } else {
      const [nouveau] = await tx
        .insert(paiementsMobileMoney)
        .values({
          affaireId,
          reference,
          montant: (montant ?? 0).toFixed(2),
          telephone,
          statut: "EN_ATTENTE",
          brut: payload as unknown as Record<string, unknown>,
        })
        .returning();
      paiementId = nouveau.id;
    }

    if (estSucces) {
      let reglementId: number | null = null;
      if (montant != null) {
        const [reglement] = await tx
          .insert(reglements)
          .values({
            affaireId,
            payeurTelephone: telephone || null,
            reference,
            montant: montant.toFixed(2),
            mode: "MOBILE_MONEY",
            commentaire: "Paiement en ligne Jemenipay",
          })
          .returning();
        reglementId = reglement.id;
      }
      await tx
        .update(paiementsMobileMoney)
        .set({ statut: "REUSSI", dateConfirmation: new Date(), reglementId, brut: payload as unknown as Record<string, unknown> })
        .where(eq(paiementsMobileMoney.id, paiementId));
    } else {
      await tx
        .update(paiementsMobileMoney)
        .set({ statut: "ECHOUE", dateConfirmation: new Date(), brut: payload as unknown as Record<string, unknown> })
        .where(eq(paiementsMobileMoney.id, paiementId));
    }
  });

  return NextResponse.json({ ok: true });
}
