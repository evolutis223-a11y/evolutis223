// §12 — intégration Jemenipay (agrégateur Mobile Money Orange Money/Moov Money, Mali).
// Doc officielle consultée et confirmée (2026-08-07, https://jemeni.net/docs) :
// - BASE_URL = https://jemeni.net/api, endpoints sous /sandbox/... ou /live/...
// - En-têtes requis : Accept, Content-Type, auth-apiKey, auth-token, auth-timestamp,
//   auth-signature, et "sandbox: true" (uniquement en mode test — absent en production).
// - Signature = HMAC-SHA512(message = SK + AK + METHOD + URL + BODY + TIMESTAMP, clé = SK),
//   URL = URL de base sans query string pour un POST, BODY = corps JSON brut.
// - Webhooks signés séparément — en-tête X-Jemeni-Signature = HMAC-SHA512(corps brut, secret webhook).

import { createHmac, timingSafeEqual } from "node:crypto";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variable d'environnement ${name} manquante — voir .env.example.`);
  return v;
}

function estSandbox(): boolean {
  return process.env.JEMENIPAY_ENV !== "live";
}

function baseUrl(): string {
  const env = estSandbox() ? "sandbox" : "live";
  return `${process.env.JEMENIPAY_API_BASE_URL ?? "https://jemeni.net/api"}/${env}`;
}

function signerRequete(secretKey: string, apiKey: string, method: string, url: string, body: string, timestamp: string): string {
  return createHmac("sha512", secretKey).update(`${secretKey}${apiKey}${method}${url}${body}${timestamp}`).digest("hex");
}

export interface InitierPaiementInput {
  montant: number;
  telephone: string; // numéro sans indicatif pays — ex. "98745632"
  reference: string; // référence externe — on utilise le numéro d'affaire
  description?: string;
  returnUrl?: string;
}

export interface InitierPaiementResult {
  ok: boolean;
  transactionId?: string;
  error?: string;
}

// La doc Jemenipay attend le numéro "sans indicatif pays" (ex. "98745632") — on retire un
// éventuel préfixe +223/223 et les espaces, le numéro complet reste inchangé partout ailleurs
// dans l'app (clients.contact, etc.).
function normaliserTelephoneMali(telephone: string): string {
  return telephone.replace(/[\s-]/g, "").replace(/^\+?223/, "");
}

export async function initierPaiementJemenipay(input: InitierPaiementInput): Promise<InitierPaiementResult> {
  const apiKey = requireEnv("JEMENIPAY_API_KEY");
  const accessToken = requireEnv("JEMENIPAY_ACCESS_TOKEN");
  const secretKey = requireEnv("JEMENIPAY_SECRET_KEY");
  const url = `${baseUrl()}/payments`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    customer_phone: normaliserTelephoneMali(input.telephone),
    amount: Math.round(input.montant),
    country_code: "ml",
    notifiable: true,
    lang: "fr",
    reference: input.reference,
    ...(input.returnUrl ? { return_url: input.returnUrl } : {}),
  });
  const signature = signerRequete(secretKey, apiKey, "POST", url, body, timestamp);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "auth-apiKey": apiKey,
    "auth-token": accessToken,
    "auth-timestamp": timestamp,
    "auth-signature": signature,
  };
  if (estSandbox()) headers.sandbox = "true";

  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers, body });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur réseau." };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Jemenipay a répondu ${res.status} : ${text.slice(0, 300)}` };
  }
  const payload = (await res.json().catch(() => ({}))) as { data?: { id?: string } };
  return { ok: true, transactionId: payload.data?.id };
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
