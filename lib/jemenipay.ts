// §12 — intégration Jemenipay (agrégateur Mobile Money Orange Money/Moov Money, Mali).
// Doc publique consultée (2026-08-07) : authentification par clé API (pk_test_/pk_live_) +
// jeton d'accès + signature HMAC-SHA512 calculée sur (clé secrète, méthode, URL, corps, horodatage
// Unix, tolérance ±5 min). Endpoints confirmés : POST /sandbox/payments (initier), GET
// /sandbox/payments/{id} (statut) ; /live/ en production. Webhooks signés séparément — en-tête
// X-Jemeni-Signature = HMAC-SHA512(corps brut, secret webhook) (capture d'écran fournie 2026-08-07).
//
// ATTENTION — les noms exacts des champs de la requête POST /payments (montant/téléphone/devise/
// référence/URL de callback) n'ont pas été confirmés contre la doc réelle (accès connecté requis,
// hors de portée ici) : la forme ci-dessous est une reconstruction raisonnable à vérifier au premier
// test réel en sandbox — ajuster `initierPaiementJemenipay` seul si les noms diffèrent.

import { createHmac, timingSafeEqual } from "node:crypto";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variable d'environnement ${name} manquante — voir .env.example.`);
  return v;
}

function baseUrl(): string {
  const env = process.env.JEMENIPAY_ENV === "live" ? "live" : "sandbox";
  // Domaine de base non confirmé publiquement — à corriger si différent de celui montré dans le
  // tableau de bord Jemenipay (ex. Postman/exemples fournis avec le compte développeur).
  return `${process.env.JEMENIPAY_API_BASE_URL ?? "https://api.jemeni.net"}/${env}`;
}

function signerRequete(secretKey: string, method: string, url: string, body: string, timestamp: string): string {
  return createHmac("sha512", secretKey).update(`${method}${url}${body}${timestamp}`).digest("hex");
}

export interface InitierPaiementInput {
  montant: number;
  telephone: string;
  reference: string; // référence externe — on utilise le numéro d'affaire
  description?: string;
  callbackUrl?: string;
}

export interface InitierPaiementResult {
  ok: boolean;
  transactionId?: string;
  error?: string;
}

export async function initierPaiementJemenipay(input: InitierPaiementInput): Promise<InitierPaiementResult> {
  const apiKey = requireEnv("JEMENIPAY_API_KEY");
  const accessToken = requireEnv("JEMENIPAY_ACCESS_TOKEN");
  const secretKey = requireEnv("JEMENIPAY_SECRET_KEY");
  const url = `${baseUrl()}/payments`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    amount: input.montant,
    phone: input.telephone,
    reference: input.reference,
    description: input.description ?? "",
    callback_url: input.callbackUrl,
  });
  const signature = signerRequete(secretKey, "POST", url, body, timestamp);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Jemeni-Api-Key": apiKey,
        "X-Jemeni-Access-Token": accessToken,
        "X-Jemeni-Signature": signature,
        "X-Jemeni-Timestamp": timestamp,
      },
      body,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur réseau." };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Jemenipay a répondu ${res.status} : ${text.slice(0, 300)}` };
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string; transaction_id?: string };
  return { ok: true, transactionId: data.transaction_id ?? data.id };
}

// Vérifie la signature d'un webhook entrant — doit être appelée sur le corps BRUT (non re-sérialisé),
// sinon la comparaison échoue même pour un webhook légitime.
export function verifierSignatureWebhookJemenipay(rawBody: string, signatureRecue: string | null): boolean {
  if (!signatureRecue) return false;
  const secret = requireEnv("JEMENIPAY_WEBHOOK_SECRET");
  const attendue = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(attendue, "hex");
  const b = Buffer.from(signatureRecue, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
