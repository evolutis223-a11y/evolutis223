import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { utilisateurs, roles, affaires, clients, articles, vStockVariante, personnel, reglements, bonsDecaissement } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess, type ModuleName } from "@/lib/permissions";
import { AppShell } from "@/components/app-shell";
import { buildShellModules } from "@/lib/shell-modules";

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [user] = await db
    .select({ nom: utilisateurs.nom, roleLibelle: roles.libelle, roleCode: roles.code })
    .from(utilisateurs)
    .innerJoin(roles, eq(utilisateurs.roleId, roles.id))
    .where(eq(utilisateurs.id, session.userId))
    .limit(1);

  if (!user) redirect("/login");

  const peutAffaires = hasModuleAccess(user.roleCode, "Affaires");
  const peutClients = hasModuleAccess(user.roleCode, "Clients");
  const peutStocks = hasModuleAccess(user.roleCode, "Stocks");
  const peutRH = hasModuleAccess(user.roleCode, "RH");
  const estAdminOuSuper = user.roleCode === "ADMIN" || user.roleCode === "SUPER_ADMIN";

  const modules = buildShellModules(user.roleCode);

  const [affairesAgg] = await db
    .select({
      total: sql<string>`count(*)`,
      ttc: sql<string>`coalesce(sum(${affaires.montantTtc}), 0)`,
      cloturees: sql<string>`count(*) filter (where ${affaires.statut} = 'CLOTUREE')`,
    })
    .from(affaires);

  const [reglementsAgg] = await db
    .select({ encaisse: sql<string>`coalesce(sum(${reglements.montant}), 0)` })
    .from(reglements);

  const [clientsAgg] = await db
    .select({
      total: sql<string>`count(*)`,
      ong: sql<string>`count(*) filter (where ${clients.typeClient} = 'ONG_CONTRAT')`,
    })
    .from(clients);

  const [articlesAgg] = await db.select({ total: sql<string>`count(*)` }).from(articles);
  const [ruptureAgg] = await db
    .select({ total: sql<string>`count(distinct ${vStockVariante.articleId})` })
    .from(vStockVariante)
    .where(sql`${vStockVariante.stockTotal} <= 0`);

  const [personnelAgg] = await db
    .select({
      total: sql<string>`count(*)`,
      salaries: sql<string>`count(*) filter (where ${personnel.typeContrat} = 'SALARIE')`,
      partenaires: sql<string>`count(*) filter (where ${personnel.typeContrat} = 'PARTENAIRE')`,
    })
    .from(personnel)
    .where(eq(personnel.actif, true));

  const now = new Date();
  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
  const peutTresorerie = hasModuleAccess(user.roleCode, "Trésorerie");

  // Trésorerie disponible (caisse espèces) : cumul depuis toujours, même logique que
  // calculerSoldeTheorique (§8.2) mais sur tout l'historique plutôt qu'une seule journée. Pas de
  // notion de "Banque" dans le schéma actuel — on ne l'affiche pas pour ne pas inventer un chiffre.
  const [tresorerieAgg] = peutTresorerie
    ? await db
        .select({
          encaisseEspeces: sql<string>`coalesce(sum(${reglements.montant}) filter (where ${reglements.mode} = 'ESPECES'), 0)`,
          decaisseValide: sql<string>`coalesce((select sum(montant) from ${bonsDecaissement} where validateur_id is not null), 0)`,
        })
        .from(reglements)
    : [{ encaisseEspeces: "0", decaisseValide: "0" }];

  const [moisAgg] = peutTresorerie
    ? await db
        .select({
          ttcMois: sql<string>`coalesce((select sum(montant_ttc) from ${affaires} where date_creation >= ${debutMois}), 0)`,
          sortiesMois: sql<string>`coalesce(sum(${bonsDecaissement.montant}) filter (where ${bonsDecaissement.validateurId} is not null), 0)`,
        })
        .from(bonsDecaissement)
        .where(and(isNotNull(bonsDecaissement.validateurId), gte(bonsDecaissement.dateCreation, debutMois)))
    : [{ ttcMois: "0", sortiesMois: "0" }];

  const tresorerieDisponible = Number(tresorerieAgg.encaisseEspeces) - Number(tresorerieAgg.decaisseValide);
  const resultatNetMois = Number(moisAgg.ttcMois) - Number(moisAgg.sortiesMois);
  const soldeRestantDu = Number(affairesAgg.ttc) - Number(reglementsAgg.encaisse);

  const heure = now.getHours();
  const salutation = heure < 12 ? "Bonjour" : heure < 18 ? "Bon après-midi" : "Bonsoir";
  const prenom = user.nom.split(" ")[0];
  const dateStr = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const narrativeText = peutTresorerie
    ? `En ce moment, EVOLUTIS223 dispose de ${fmt(tresorerieDisponible)} en caisse (espèces). Ce mois-ci : ${fmt(resultatNetMois)} de résultat net (CA facturé moins sorties validées), pour ${affairesAgg.total} affaire(s) au total et ${fmt(Number(reglementsAgg.encaisse))} encaissés depuis le début. ${Number(ruptureAgg.total) > 0 ? `${ruptureAgg.total} article(s) en rupture de stock à traiter.` : "Aucune rupture de stock en cours."}`
    : null;

  const kpis = [
    { label: "CA TTC", value: fmt(Number(affairesAgg.ttc)) },
    { label: "Encaissé", value: fmt(Number(reglementsAgg.encaisse)) },
    { label: "Affaires", value: affairesAgg.total },
    { label: "Clients", value: clientsAgg.total },
  ];

  const cartesModules = [
    peutAffaires && {
      key: "Affaires" as ModuleName,
      titre: "Affaires",
      icone: "📋",
      href: "/affaires",
      lignes: [
        { label: "Total", value: affairesAgg.total },
        { label: "Clôturées", value: affairesAgg.cloturees },
        { label: "En cours", value: String(Number(affairesAgg.total) - Number(affairesAgg.cloturees)) },
      ],
      piedLabel: "TTC cumulé",
      piedValue: fmt(Number(affairesAgg.ttc)),
      piedCouleur: "#3b82f6",
    },
    peutClients && {
      key: "Clients" as ModuleName,
      titre: "Clients",
      icone: "👥",
      href: "/clients",
      lignes: [
        { label: "Total", value: clientsAgg.total },
        { label: "Contrat ONG", value: clientsAgg.ong },
      ],
      piedLabel: "Règlements encaissés",
      piedValue: fmt(Number(reglementsAgg.encaisse)),
      piedCouleur: "#3b82f6",
    },
    peutStocks && {
      key: "Stocks" as ModuleName,
      titre: "Stock",
      icone: "📦",
      href: "/stocks",
      lignes: [
        { label: "Articles", value: articlesAgg.total },
        { label: "En rupture", value: ruptureAgg.total },
      ],
      piedLabel: "Articles en rupture",
      piedValue: String(ruptureAgg.total),
      piedCouleur: Number(ruptureAgg.total) > 0 ? "#dc2626" : "#10b981",
    },
    peutRH && {
      key: "RH" as ModuleName,
      titre: "Équipe",
      icone: "👤",
      href: "/rh",
      lignes: [
        { label: "Effectif", value: personnelAgg.total },
        { label: "Salariés", value: personnelAgg.salaries },
        { label: "Partenaires", value: personnelAgg.partenaires },
      ],
      piedLabel: "Effectif actif",
      piedValue: String(personnelAgg.total),
      piedCouleur: "#f59e0b",
    },
  ].filter(Boolean) as {
    key: ModuleName;
    titre: string;
    icone: string;
    href: string;
    lignes: { label: string; value: string }[];
    piedLabel: string;
    piedValue: string;
    piedCouleur: string;
  }[];

  const actionsRapides = [
    peutAffaires && { label: "Nouvelle affaire", icone: "➕", href: "/vente-comptoir", primaire: true },
    peutAffaires && { label: "Règlement", icone: "💰", href: "/affaires", primaire: false },
    estAdminOuSuper && { label: "Tour de contrôle", icone: "👑", href: "/validations", primaire: false },
  ].filter(Boolean) as { label: string; icone: string; href: string; primaire: boolean }[];

  // Modules accessibles à ce rôle mais sans page dédiée construite pour l'instant (donc absents
  // de la barre du haut) — Règlements, Documents, Paramètres, plus les modules hors maquette
  // d'origine (Frais numériques, Production).
  const modulesSansEcranDedie: { label: string; href?: string }[] = [
    hasModuleAccess(user.roleCode, "Production") && { label: "Production" },
    hasModuleAccess(user.roleCode, "Règlements") && { label: "Règlements (voir Affaires)", href: "/affaires" },
    hasModuleAccess(user.roleCode, "Documents") && { label: "Documents" },
    hasModuleAccess(user.roleCode, "Paramètres") && { label: "Paramètres" },
    hasModuleAccess(user.roleCode, "Frais numériques") && { label: "Frais numériques", href: "/frais-numeriques" },
  ].filter(Boolean) as { label: string; href?: string }[];

  return (
    <AppShell userName={user.nom} roleLibelle={user.roleLibelle} pageTitle="Tableau de bord" modules={modules}>
      <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>
              {salutation}, {prenom}
            </div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 2, textTransform: "capitalize" }}>{dateStr}</div>
          </div>
          {actionsRapides.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {actionsRapides.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: a.primaire ? 700 : 400,
                    padding: "9px 14px",
                    borderRadius: 8,
                    background: a.primaire ? "#3b82f6" : "#1e1e1e",
                    color: a.primaire ? "#fff" : "#e0e0e0",
                    border: a.primaire ? "none" : "1px solid #333",
                  }}
                >
                  <span>{a.icone}</span>
                  {a.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {narrativeText && (
          <div style={{ background: "#182233", border: "1px solid #2a3a55", borderRadius: 10, padding: "16px 20px", marginBottom: 22, fontSize: 14, color: "#dbe4f5", lineHeight: 1.5 }}>
            {narrativeText}
          </div>
        )}

        {peutTresorerie && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
            <Link href="/tresorerie" style={{ textDecoration: "none", color: "inherit", cursor: "pointer", background: "#1e1e1e", border: "1px solid #10b981", borderRadius: 10, padding: 20 }}>
              <span style={{ color: "#888", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>Trésorerie disponible (caisse)</span>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginTop: 8 }}>{fmt(tresorerieDisponible)}</div>
            </Link>
            <Link href="/tresorerie" style={{ textDecoration: "none", color: "inherit", cursor: "pointer", background: "#1e1e1e", border: "1px solid #333", borderRadius: 10, padding: 20 }}>
              <span style={{ color: "#888", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>Résultat net — ce mois-ci</span>
              <div style={{ fontSize: 28, fontWeight: 800, color: resultatNetMois >= 0 ? "#10b981" : "#dc2626", marginTop: 8 }}>{fmt(resultatNetMois)}</div>
            </Link>
            <Link href="/affaires" style={{ textDecoration: "none", color: "inherit", cursor: "pointer", background: "#1e1e1e", border: "1px solid #333", borderRadius: 10, padding: 20 }}>
              <span style={{ color: "#888", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>Total facturé (TTC, toutes affaires)</span>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginTop: 8 }}>{fmt(Number(affairesAgg.ttc))}</div>
              <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>Solde restant dû : {fmt(soldeRestantDu)}</div>
            </Link>
          </div>
        )}

        {/* KPI — repli pour les rôles sans accès Trésorerie (pas de tuiles santé pour eux) */}
        {!peutTresorerie && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 24 }}>
            {kpis.map((k) => (
              <div key={k.label} style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.3 }}>{k.label}</div>
                <div style={{ fontSize: 19, fontWeight: 700, marginTop: 4, color: "#fff" }}>{k.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Cartes modules principaux */}
        {cartesModules.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              Modules — vue d&apos;ensemble
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 30 }}>
              {cartesModules.map((c) => (
                <Link
                  key={c.key}
                  href={c.href}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    textDecoration: "none",
                    color: "inherit",
                    cursor: "pointer",
                    background: "#1e1e1e",
                    border: "1px solid #333",
                    borderRadius: 10,
                    padding: 18,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
                    <span style={{ fontSize: 18 }}>{c.icone}</span>
                    {c.titre}
                  </div>
                  {c.lignes.map((l) => (
                    <div
                      key={l.label}
                      style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#ccc", padding: "4px 0", borderTop: "1px solid #262626" }}
                    >
                      <span>{l.label}</span>
                      <span style={{ fontWeight: 700, color: "#fff" }}>{l.value}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #262626", fontSize: 12 }}>
                    <span style={{ color: "#888" }}>{c.piedLabel} </span>
                    <span style={{ fontWeight: 700, color: c.piedCouleur }}>{c.piedValue}</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Autres liens */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {hasModuleAccess(user.roleCode, "Trésorerie") && (
            <Link
              href="/fonds-circulation"
              style={{ display: "block", textDecoration: "none", color: "#e0e0e0", background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}
            >
              💵 Fonds en circulation (§8.2)
            </Link>
          )}
          {peutAffaires && (
            <Link
              href="/vente-comptoir"
              style={{ display: "block", textDecoration: "none", color: "#e0e0e0", background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}
            >
              🧾 Poste de vente comptoir — résiste aux coupures internet (§3.3)
            </Link>
          )}
        </div>

        {modulesSansEcranDedie.length > 0 && (
          <div>
            <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              Autres modules accessibles
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {modulesSansEcranDedie.map((m) =>
                m.href ? (
                  <Link
                    key={m.label}
                    href={m.href}
                    style={{ textDecoration: "none", color: "#e0e0e0", background: "#151515", border: "1px solid #2a2a2a", borderRadius: 8, padding: "8px 12px", fontSize: 12.5 }}
                  >
                    {m.label}
                  </Link>
                ) : (
                  <div key={m.label} style={{ color: "#555", background: "#151515", border: "1px solid #2a2a2a", borderRadius: 8, padding: "8px 12px", fontSize: 12.5 }}>
                    {m.label} <span style={{ fontSize: 10 }}>(à construire)</span>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
