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

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const telephone = String(formData.get("telephone") ?? "").trim();
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
    })
    .from(utilisateurs)
    .innerJoin(roles, eq(utilisateurs.roleId, roles.id))
    .where(eq(utilisateurs.telephone, telephone))
    .limit(1);

  // Message volontairement identique (téléphone inconnu vs PIN faux vs compte inactif)
  // pour ne pas révéler si un numéro existe dans la base.
  const invalid = { error: "Téléphone ou PIN incorrect." };

  if (!user || !user.actif) return invalid;

  const pinOk = await bcrypt.compare(pin, user.pinHash);
  if (!pinOk) return invalid;

  await createSession({ userId: user.id, roleCode: user.roleCode });
  redirect("/");
}
