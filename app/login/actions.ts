"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { utilisateurs, roles } from "@/db/schema";
import { createSession } from "@/lib/auth";

export interface LoginState {
  error: string | null;
}

const MAX_TENTATIVES = 5;
const BLOCAGE_MINUTES = 15;

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  // Le placeholder affiche "+223 00 00 00 00" (espacé) — normalise les espaces internes en plus
  // du trim, sinon un client qui tape le numéro exactement comme le modèle affiché ne correspond
  // plus à la valeur stockée sans espaces et se voit refuser un compte pourtant valide.
  const telephone = String(formData.get("telephone") ?? "").trim().replace(/\s+/g, "");
  const pin = String(formData.get("pin") ?? "").trim();

  if (!telephone || !pin) {
    return { error: "Téléphone et PIN requis." };
  }

  const [user] = await db
    .select({
      id: utilisateurs.id,
      pinHash: utilisateurs.pinHash,
      actif: utilisateurs.actif,
      roleCode: roles.code,
      tentativesEchouees: utilisateurs.tentativesEchouees,
      bloqueJusqua: utilisateurs.bloqueJusqua,
    })
    .from(utilisateurs)
    .innerJoin(roles, eq(utilisateurs.roleId, roles.id))
    .where(eq(utilisateurs.telephone, telephone))
    .limit(1);

  // Message volontairement identique (téléphone inconnu vs PIN faux vs compte inactif)
  // pour ne pas révéler si un numéro existe dans la base.
  const invalid = { error: "Téléphone ou PIN incorrect." };

  if (!user || !user.actif) return invalid;

  // §16.2 : blocage après tentatives échouées (bcrypt = hachage déjà renforcé depuis Phase 0).
  if (user.bloqueJusqua && user.bloqueJusqua > new Date()) {
    const minutes = Math.ceil((user.bloqueJusqua.getTime() - Date.now()) / 60000);
    return { error: `Compte temporairement bloqué (trop de tentatives). Réessayez dans ${minutes} min.` };
  }

  const pinOk = await bcrypt.compare(pin, user.pinHash);
  if (!pinOk) {
    const tentatives = user.tentativesEchouees + 1;
    const atteintLimite = tentatives >= MAX_TENTATIVES;
    await db
      .update(utilisateurs)
      .set({
        tentativesEchouees: atteintLimite ? 0 : tentatives,
        bloqueJusqua: atteintLimite ? new Date(Date.now() + BLOCAGE_MINUTES * 60_000) : null,
      })
      .where(eq(utilisateurs.id, user.id));
    if (atteintLimite) {
      return { error: `Compte temporairement bloqué (trop de tentatives). Réessayez dans ${BLOCAGE_MINUTES} min.` };
    }
    return invalid;
  }

  await db
    .update(utilisateurs)
    .set({ tentativesEchouees: 0, bloqueJusqua: null })
    .where(eq(utilisateurs.id, user.id));

  await createSession({ userId: user.id, roleCode: user.roleCode });
  redirect("/hub");
}

// Décision utilisateur 2026-08-04 : accès direct sans PIN pendant la période de vérification —
// "nous imposerons des règles justes avant commit". La fonction `login()` ci-dessus (PIN + bcrypt
// + blocage anti-brute-force) reste intacte et branchable à tout moment ; ceci est un chemin
// temporaire en parallèle, pas un remplacement. À retirer avant mise en production réelle.
export async function loginDirect(telephone: string) {
  const [user] = await db
    .select({ id: utilisateurs.id, actif: utilisateurs.actif, roleCode: roles.code })
    .from(utilisateurs)
    .innerJoin(roles, eq(utilisateurs.roleId, roles.id))
    .where(eq(utilisateurs.telephone, telephone))
    .limit(1);

  if (!user || !user.actif) return;

  await createSession({ userId: user.id, roleCode: user.roleCode });
  redirect("/hub");
}
