"use client";

import { AppShell, type ShellModule } from "@/components/app-shell";

export function ParametresClient({
  userName,
  roleLibelle,
  modules,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
}) {
  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Paramètres" modules={modules}>
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Paramètres</div>
        <div style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: 20, color: "#888", fontSize: 13.5 }}>
          Module pas encore construit — onglets Général / Modèles de documents / Catégories d&apos;articles / Site &amp; Marketing / Support &amp; bugs / Documentation à venir.
        </div>
      </div>
    </AppShell>
  );
}
