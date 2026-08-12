"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

// Icône d'aide contextuelle (§ demande utilisateur 2026-08-08) — une petite bulle légère par page
// (ou par section complexe), jamais un popup bloquant. Toujours accompagnée d'exemples concrets,
// pas juste une description abstraite de l'écran.
//
// Positionnement en `fixed` + deux passes (§ correction 2026-08-12, plusieurs bulles s'ouvraient
// hors de l'écran) : la 1re passe positionne près du bouton en restant dans le viewport, la 2e
// (après rendu réel, via useLayoutEffect) corrige selon la hauteur/largeur effective de la bulle —
// nécessaire car le contenu (donc la taille) varie d'un écran à l'autre.
export function AideBulle({ titre, children }: { titre: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 320 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  function ouvrir() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(320, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
      const top = Math.min(rect.bottom + 8, window.innerHeight - 60);
      setPos({ top, left, width });
    }
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open || !popRef.current) return;
    const rect = popRef.current.getBoundingClientRect();
    let { top, left } = pos;
    let changed = false;
    if (rect.bottom > window.innerHeight - 12) {
      const btnRect = btnRef.current?.getBoundingClientRect();
      top = Math.max(12, (btnRect ? btnRect.top : top) - rect.height - 8);
      changed = true;
    }
    if (rect.right > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - rect.width - 12);
      changed = true;
    }
    if (rect.left < 12) {
      left = 12;
      changed = true;
    }
    if (changed) setPos((p) => ({ ...p, top, left }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : ouvrir())}
        aria-label={`Aide — ${titre}`}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card text-xs font-bold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        ?
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={popRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
            className="z-50 max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-card p-4 text-sm shadow-xl"
          >
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
