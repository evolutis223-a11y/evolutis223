import { eq } from "drizzle-orm";
import { db } from "@/db";
import { utilisateurs, roles } from "@/db/schema";

// Petit helper répété sur chaque page pour peupler l'en-tête d'AppShell (nom + libellé du rôle).
export async function chargerUtilisateurAffiche(userId: number) {
  const [user] = await db
    .select({ nom: utilisateurs.nom, roleLibelle: roles.libelle })
    .from(utilisateurs)
    .innerJoin(roles, eq(utilisateurs.roleId, roles.id))
    .where(eq(utilisateurs.id, userId))
    .limit(1);
  return user;
}
