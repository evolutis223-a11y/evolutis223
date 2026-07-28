import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { ClientsClient } from "./clients-client";

export default async function ClientsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasModuleAccess(session.roleCode, "Clients")) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Ce rôle n&apos;a pas accès au module Clients.</p>
      </main>
    );
  }

  const rows = await db.select().from(clients).orderBy(desc(clients.id));
  return <ClientsClient clients={rows} />;
}
