import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { utilisateurs, roles } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { LoginClient } from "./login-client";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/hub");

  const roster = await db
    .select({ nom: utilisateurs.nom, telephone: utilisateurs.telephone, roleLibelle: roles.libelle, roleCode: roles.code })
    .from(utilisateurs)
    .innerJoin(roles, eq(utilisateurs.roleId, roles.id))
    .where(eq(utilisateurs.actif, true))
    .orderBy(roles.id, utilisateurs.nom);

  return <LoginClient roster={roster} />;
}
