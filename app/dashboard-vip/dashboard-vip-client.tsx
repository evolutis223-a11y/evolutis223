"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { rafraichirVenteJour, type DonneesVip, type VenteRecente } from "./actions";

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}
function heureRelative(d: Date) {
  const min = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Date(d).toLocaleDateString("fr-FR");
}

function beepVente() {
  try {
    const ctx = new AudioContext();
    const notes = [
      { freq: 880, dur: 0.1, delay: 0 },
      { freq: 1320, dur: 0.16, delay: 0.1 },
    ];
    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = n.freq;
      gain.gain.value = 0.18;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + n.delay);
      osc.stop(ctx.currentTime + n.delay + n.dur);
    });
    setTimeout(() => ctx.close(), 400);
  } catch {
    // AudioContext indisponible — silencieux.
  }
}

const WIDGETS_DEFAUT = ["chart", "commandes", "partenaires"] as const;
type WidgetKey = (typeof WIDGETS_DEFAUT)[number];
const ORDRE_KEY = "evolutis223_vip_widgets_ordre";
const SON_KEY = "evolutis223_vip_son_actif";

export function DashboardVipClient({ userName, initial }: { userName: string; initial: DonneesVip }) {
  const [donnees, setDonnees] = useState(initial);
  const [flash, setFlash] = useState(false);
  const [sonActif, setSonActif] = useState(true);
  const [ordre, setOrdre] = useState<WidgetKey[]>([...WIDGETS_DEFAUT]);
  const draggedRef = useRef<WidgetKey | null>(null);
  const prevVentesJour = useRef(initial.ventesJour);

  useEffect(() => {
    const stored = localStorage.getItem(ORDRE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as WidgetKey[];
        if (Array.isArray(parsed) && parsed.length === WIDGETS_DEFAUT.length) setOrdre(parsed);
      } catch {
        // ignore
      }
    }
    const sonStocke = localStorage.getItem(SON_KEY);
    if (sonStocke != null) setSonActif(sonStocke === "1");
  }, []);

  useEffect(() => {
    const t = setInterval(async () => {
      const res = await rafraichirVenteJour();
      setDonnees((d) => ({ ...d, ventesJour: res.ventesJour, dernieresVentes: res.dernieresVentes }));
      if (res.ventesJour > prevVentesJour.current) {
        setFlash(true);
        if (sonActif) beepVente();
        setTimeout(() => setFlash(false), 900);
      }
      prevVentesJour.current = res.ventesJour;
    }, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sonActif]);

  function toggleSon() {
    setSonActif((s) => {
      localStorage.setItem(SON_KEY, s ? "0" : "1");
      return !s;
    });
  }

  function onDrop(cible: WidgetKey) {
    const source = draggedRef.current;
    if (!source || source === cible) return;
    setOrdre((prev) => {
      const next = prev.filter((k) => k !== source);
      next.splice(next.indexOf(cible), 0, source);
      localStorage.setItem(ORDRE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const deltaHier = donnees.ventesHier > 0 ? Math.round(((donnees.ventesJour - donnees.ventesHier) / donnees.ventesHier) * 100) : null;
  const maxChart = Math.max(1, ...donnees.ca7Jours.map((j) => j.valeur));

  return (
    <div className="vip-root">
      <style dangerouslySetInnerHTML={{ __html: VIP_CSS }} />

      <div className={`live-card${flash ? " flash" : ""}`}>
        <div className="live-head">
          <span className="live-dot" />
          <span className="live-label">Vente du jour — en direct</span>
          <button className="live-sound" onClick={toggleSon} title="Activer/désactiver l'alerte sonore">
            {sonActif ? "🔊 Alerte sonore activée" : "🔇 Alerte sonore coupée"}
          </button>
        </div>
        <div className="live-figure-row">
          <div className="live-figure">{fmt(donnees.ventesJour)}</div>
          <div className="live-yesterday">
            <span className="k">Hier</span>
            <span className="v">
              {fmt(donnees.ventesHier)} {deltaHier !== null && <span style={{ color: deltaHier >= 0 ? "#4ade80" : "#f87171" }}>{deltaHier >= 0 ? "▲" : "▼"}{Math.abs(deltaHier)}%</span>}
            </span>
          </div>
        </div>
        <div className="live-sub">Cette semaine : {fmt(donnees.ventesSemaine)} — {donnees.dernieresVentes.length > 0 ? `dernière ${heureRelative(donnees.dernieresVentes[0].dateCreation)}` : "aucune vente pour l'instant"}</div>
        <div className="live-feed">
          {donnees.dernieresVentes.slice(0, 4).map((v) => (
            <VenteRow key={v.id} vente={v} />
          ))}
          {donnees.dernieresVentes.length === 0 && <p style={{ fontSize: 12.5, color: "var(--ink-mute)" }}>Rien pour l&apos;instant aujourd&apos;hui.</p>}
        </div>
      </div>

      <div className="widgets-head">
        <h2>Widgets — glisser pour réorganiser</h2>
        <span className="hint">⋮⋮ maintenir et déplacer</span>
      </div>

      <div className="widget-grid">
        {ordre.map((key) => (
          <div
            key={key}
            className="widget"
            draggable
            onDragStart={() => (draggedRef.current = key)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(key)}
          >
            <span className="drag-handle">⋮⋮</span>
            {key === "chart" && (
              <>
                <h3>CA — 7 derniers jours</h3>
                <div className="chart-bars">
                  {donnees.ca7Jours.map((j, i) => (
                    <div key={i} className="bar" style={{ height: `${Math.max(4, (j.valeur / maxChart) * 100)}%` }} title={fmt(j.valeur)} />
                  ))}
                </div>
                <div className="chart-caption">
                  {donnees.ca7Jours.map((j, i) => (
                    <span key={i}>{j.label}</span>
                  ))}
                </div>
              </>
            )}
            {key === "commandes" && (
              <>
                <h3>Commandes en ligne</h3>
                <div className="kpi-mini">
                  <div>
                    <div className="k">Total</div>
                    <div className="v">{donnees.commandesEnLigne.total}</div>
                  </div>
                  <div>
                    <div className="k">En attente</div>
                    <div className="v">{donnees.commandesEnLigne.enAttente}</div>
                  </div>
                </div>
                <Link href="/affaires" className="widget-link">
                  Voir les affaires →
                </Link>
              </>
            )}
            {key === "partenaires" && (
              <>
                <h3>Raccourcis partenaires</h3>
                {donnees.partenaires.length === 0 && <p style={{ fontSize: 12.5, color: "var(--ink-mute)" }}>Aucun partenaire actif.</p>}
                <div className="partner-list">
                  {donnees.partenaires.map((p) => (
                    <div key={p.utilisateurId} className="partner-row">
                      <div className="partner-avatar">
                        {p.nom
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <div className="partner-name">{p.nom}</div>
                        <div className="partner-meta">
                          {fmt(p.ventesMois)} ce mois · {p.clicsMois} clic(s)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Link href="/commercial" className="widget-link">
                  Voir Commercial →
                </Link>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function VenteRow({ vente }: { vente: VenteRecente }) {
  return (
    <div className="live-feed-row">
      <div className="live-feed-left">
        <span>🔔</span> {vente.clientNom}
        {vente.provenance && <span className="live-feed-tag">{vente.provenance}</span>}
      </div>
      <div>
        <span className="live-feed-amt">{fmt(vente.montantTtc)}</span> <span className="live-feed-time">{heureRelative(vente.dateCreation)}</span>
      </div>
    </div>
  );
}

const VIP_CSS = `
.vip-root {
  --bg-elevated: #111318; --card: #15171d; --card-hover: #1a1d24; --line: #24272f; --line-soft: #1c1f26;
  --ink: #f2f1ed; --ink-soft: #9a9ba3; --ink-mute: #5c5e68; --gold: #d3a25c; --gold-soft: rgba(211,162,92,0.14);
  --green: #4ade80; --green-soft: rgba(74,222,128,0.12); --red: #f87171;
  color: var(--ink);
}
.vip-root .live-card { position: relative; background: linear-gradient(155deg, #1a1610 0%, var(--card) 55%); border: 1px solid rgba(211,162,92,0.3); border-radius: 16px; padding: 26px 28px; overflow: hidden; animation: vip-ambient-glow 5s ease-in-out infinite; }
.vip-root .live-card::before { content: ""; position: absolute; top: -60px; right: -60px; width: 220px; height: 220px; background: radial-gradient(circle, rgba(211,162,92,0.18), transparent 70%); animation: vip-ambient-drift 6s ease-in-out infinite; pointer-events: none; }
@keyframes vip-ambient-glow { 0%, 100% { border-color: rgba(211,162,92,0.3); box-shadow: 0 0 0 rgba(211,162,92,0); } 50% { border-color: rgba(211,162,92,0.55); box-shadow: 0 0 24px rgba(211,162,92,0.08); } }
@keyframes vip-ambient-drift { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-10px, 8px) scale(1.08); } }
.vip-root .live-card.flash { animation: vip-flash-sale 0.9s ease; }
@keyframes vip-flash-sale { 0% { background: var(--card); } 15% { background: rgba(74,222,128,0.22); border-color: var(--green); } 100% { background: linear-gradient(155deg, #1a1610 0%, var(--card) 55%); } }
.vip-root .live-head { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; flex-wrap: wrap; }
.vip-root .live-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--green); box-shadow: 0 0 0 0 rgba(74,222,128,0.6); animation: vip-pulse-dot 1.8s infinite; flex-shrink: 0; }
@keyframes vip-pulse-dot { 0% { box-shadow: 0 0 0 0 rgba(74,222,128,0.55);} 70% { box-shadow: 0 0 0 10px rgba(74,222,128,0);} 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0);} }
.vip-root .live-label { font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--green); }
.vip-root .live-sound { margin-left: auto; display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--ink-soft); background: var(--bg-elevated); border: 1px solid var(--line); padding: 5px 10px; border-radius: 999px; cursor: pointer; }
.vip-root .live-figure-row { display: flex; align-items: baseline; gap: 18px; flex-wrap: wrap; margin-top: 8px; }
.vip-root .live-figure { font-size: 52px; font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; line-height: 1; }
.vip-root .live-yesterday { display: flex; flex-direction: column; gap: 2px; padding-bottom: 4px; }
.vip-root .live-yesterday .k { font-size: 10px; color: var(--ink-mute); text-transform: uppercase; letter-spacing: 0.05em; }
.vip-root .live-yesterday .v { font-size: 13px; color: var(--ink-soft); font-weight: 700; font-variant-numeric: tabular-nums; }
.vip-root .live-sub { font-size: 12.5px; color: var(--ink-soft); margin-top: 6px; }
.vip-root .live-feed { margin-top: 16px; display: flex; flex-direction: column; gap: 7px; }
.vip-root .live-feed-row { display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; padding: 8px 10px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid var(--line-soft); flex-wrap: wrap; gap: 6px; }
.vip-root .live-feed-left { display: flex; align-items: center; gap: 8px; color: var(--ink); }
.vip-root .live-feed-tag { font-size: 9.5px; color: var(--ink-mute); background: var(--bg-elevated); padding: 2px 7px; border-radius: 5px; }
.vip-root .live-feed-time { color: var(--ink-mute); font-size: 11px; }
.vip-root .live-feed-amt { font-weight: 700; font-variant-numeric: tabular-nums; }
.vip-root .widgets-head { display: flex; align-items: center; justify-content: space-between; margin: 22px 0 12px; }
.vip-root .widgets-head h2 { font-size: 13px; margin: 0; color: var(--ink-soft); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
.vip-root .widgets-head .hint { font-size: 11px; color: var(--ink-mute); }
.vip-root .widget-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.vip-root .widget { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 18px; position: relative; cursor: grab; }
.vip-root .widget:hover { border-color: rgba(211,162,92,0.4); background: var(--card-hover); }
.vip-root .drag-handle { position: absolute; top: 14px; right: 14px; color: var(--ink-mute); font-size: 13px; letter-spacing: 2px; }
.vip-root .widget h3 { font-size: 12px; margin: 0 0 12px; color: var(--ink-soft); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.vip-root .chart-bars { display: flex; align-items: flex-end; gap: 6px; height: 90px; }
.vip-root .chart-bars .bar { flex: 1; background: linear-gradient(180deg, var(--gold), rgba(211,162,92,0.25)); border-radius: 4px 4px 0 0; }
.vip-root .chart-caption { display: flex; justify-content: space-between; margin-top: 8px; font-size: 10px; color: var(--ink-mute); text-transform: capitalize; }
.vip-root .kpi-mini { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.vip-root .kpi-mini div { background: var(--bg-elevated); border-radius: 8px; padding: 10px; }
.vip-root .kpi-mini .k { font-size: 10px; color: var(--ink-mute); text-transform: uppercase; letter-spacing: 0.05em; }
.vip-root .kpi-mini .v { font-size: 17px; font-weight: 800; margin-top: 2px; font-variant-numeric: tabular-nums; }
.vip-root .partner-list { display: flex; flex-direction: column; gap: 10px; }
.vip-root .partner-row { display: flex; align-items: center; gap: 10px; font-size: 12.5px; }
.vip-root .partner-avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; flex-shrink: 0; }
.vip-root .partner-name { font-weight: 700; }
.vip-root .partner-meta { color: var(--ink-mute); font-size: 11px; }
.vip-root .widget-link { display: inline-block; margin-top: 14px; color: var(--gold); font-size: 11.5px; font-weight: 700; text-decoration: none; }
@media (max-width: 900px) {
  .vip-root .widget-grid { grid-template-columns: 1fr; }
  .vip-root .live-figure { font-size: 38px; }
}
`;
