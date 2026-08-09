"use client";

import { useEffect, useState, useTransition } from "react";
import { AppShell, type ShellModule } from "@/components/app-shell";
import { RapportPreview } from "@/components/documents/rapport-preview";
import { chargerRapportDocumentData } from "../actions";
import type { RapportDocumentData } from "@/lib/documents/types";

const MOIS_LONGS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export function RapportArchiveClient({
  userName,
  roleLibelle,
  modules,
  mois,
}: {
  userName: string;
  roleLibelle: string;
  modules: ShellModule[];
  mois: { annee: number; mois: number }[];
}) {
  const [selected, setSelected] = useState<{ annee: number; mois: number } | null>(mois[0] ?? null);
  const [data, setData] = useState<RapportDocumentData | null>(null);
  const [isPending, startTransition] = useTransition();

  function choisir(m: { annee: number; mois: number }) {
    setSelected(m);
    startTransition(async () => setData(await chargerRapportDocumentData(m.annee, m.mois)));
  }

  // Charge l'aperçu du premier mois au montage (comportement attendu : un aperçu visible tout de
  // suite, pas une page vide avant le premier clic).
  useEffect(() => {
    if (selected) chargerRapportDocumentData(selected.annee, selected.mois).then(setData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell userName={userName} roleLibelle={roleLibelle} pageTitle="Archive des rapports" modules={modules}>
      <div style={{ display: "flex", gap: 20, padding: 20, height: "calc(100vh - 118px)", boxSizing: "border-box" }}>
        <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Archive des rapports</div>
          <p style={{ fontSize: 12, color: "#888", marginBottom: 14, marginTop: 0 }}>
            Un document officiel par mois — prêt pour une banque ou un partenaire.
          </p>
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, border: "1px solid #262626", borderRadius: 8 }}>
            {mois.map((m) => {
              const estSelectionne = selected?.annee === m.annee && selected?.mois === m.mois;
              return (
                <div
                  key={`${m.annee}-${m.mois}`}
                  onClick={() => choisir(m)}
                  style={{
                    padding: "11px 14px",
                    fontSize: 13,
                    cursor: "pointer",
                    background: estSelectionne ? "#263041" : "transparent",
                    color: estSelectionne ? "#fff" : "#ccc",
                    borderBottom: "1px solid #262626",
                  }}
                >
                  {MOIS_LONGS[m.mois - 1]} {m.annee}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {!selected || !data ? (
            <div style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: 28, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: 13 }}>
              {isPending ? "Chargement..." : "Cliquez un mois à gauche pour voir son aperçu."}
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, opacity: isPending ? 0.5 : 1, transition: "opacity .15s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
                  Aperçu — {MOIS_LONGS[selected.mois - 1]} {selected.annee}
                </div>
                <a
                  href={`/api/documents/rapport/${selected.annee}/${selected.mois}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: "#3b82f6", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 6, fontSize: 13, fontWeight: 700, textDecoration: "none" }}
                >
                  🖨️ Imprimer
                </a>
              </div>
              <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                <RapportPreview data={data} />
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
