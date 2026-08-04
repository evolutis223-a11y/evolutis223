import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { utilisateurs, roles } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { HubClient } from "./hub-client";

export default async function HubPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [user] = await db
    .select({ nom: utilisateurs.nom, roleLibelle: roles.libelle })
    .from(utilisateurs)
    .innerJoin(roles, eq(utilisateurs.roleId, roles.id))
    .where(eq(utilisateurs.id, session.userId))
    .limit(1);

  if (!user) redirect("/login");

  return <HubClient userName={user.nom} roleLibelle={user.roleLibelle} />;
}
