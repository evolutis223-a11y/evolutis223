"use client";

import { useState, type ReactNode } from "react";

// Icône d'aide contextuelle (§ demande utilisateur 2026-08-08) — une petite bulle légère par page
// (ou par section complexe), jamais un popup bloquant. Toujours accompagnée d'exemples concrets,
// pas juste une description abstraite de l'écran.
export function AideBulle({ titre, children }: { titre: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Aide — ${titre}`}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card text-xs font-bold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        ?
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-80 max-w-[85vw] rounded-lg border border-border bg-card p-4 text-sm shadow-xl">
            <div className="mb-2 flex items-start justify-between gap-2">
              <span className="font-semibold text-foreground">{titre}</span>
              <button onClick={() => setOpen(false)} aria-label="Fermer" className="text-muted-foreground hover:text-foreground">
                ×
              </button>
            </div>
            <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">{children}</div>
          </div>
        </>
      )}
    </div>
  );
}
