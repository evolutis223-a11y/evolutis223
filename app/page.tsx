import { and, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { utilisateurs, roles, affaires, clients, articles, vStockVariante, personnel, reglements } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasModuleAccess, modulesForRole, type ModuleName } from "@/lib/permissions";
import { logout } from "./actions";

// Routes réellement construites — les autres modules restent des tuiles non cliquables
// tant que leur page n'existe pas.
const MODULE_ROUTES: Partial<Record<ModuleName, string>> = {
  Catalogue: "/catalogue",
  "Nos produits": "/boutique",
  "R&D": "/rd-calculateurs",
  Marketing: "/marketing",
  Stocks: "/stocks",
  Production: "/production",
  Clients: "/clients",
  Affaires: "/affaires",
  Commandes: "/commandes",
  Trésorerie: "/tresorerie",
  Commercial: "/commercial",
  Fournisseurs: "/fournisseurs",
  Achats: "/achats",
  Dépenses: "/depenses",
  Charges: "/charges",
  RH: "/rh",
  Rapports: "/rapports",
  "Frais numériques": "/frais-numeriques",
};

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} F`;
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

  const modules = modulesForRole(user.roleCode);
  const peutAffaires = hasModuleAccess(user.roleCode, "Affaires");
  const peutClients = hasModuleAccess(user.roleCode, "Clients");
  const peutStocks = hasModuleAccess(user.roleCode, "Stocks");
  const peutRH = hasModuleAccess(user.roleCode, "RH");
  const estAdminOuSuper = user.roleCode === "ADMIN" || user.roleCode === "SUPER_ADMIN";

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
  const heure = now.getHours();
  const salutation = heure < 12 ? "Bonjour" : heure < 18 ? "Bon après-midi" : "Bonsoir";
  const prenom = user.nom.split(" ")[0];
  const dateStr = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

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
    peutAffaires && { label: "Nouvelle affaire", icone: "➕", href: "/affaires", primaire: true },
    peutAffaires && { label: "Règlement", icone: "💰", href: "/affaires", primaire: false },
    estAdminOuSuper && { label: "Tour de contrôle", icone: "👑", href: "/validations", primaire: false },
  ].filter(Boolean) as { label: string; icone: string; href: string; primaire: boolean }[];

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 24px 60px" }}>
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 26, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {salutation}, {prenom}
            </div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 2, textTransform: "capitalize" }}>{dateStr}</div>
            <div style={{ fontSize: 12, color: "#3b82f6", fontWeight: 700, marginTop: 6 }}>{user.roleLibelle}</div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              style={{ background: "none", border: "1px solid #333", color: "#e0e0e0", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}
            >
              Se déconnecter
            </button>
          </form>
        </header>

        {/* KPI */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 22 }}>
          {kpis.map((k) => (
            <div key={k.label} style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.3 }}>{k.label}</div>
              <div style={{ fontSize: 19, fontWeight: 700, marginTop: 4 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Actions rapides */}
        {actionsRapides.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginBottom: 26, flexWrap: "wrap" }}>
            {actionsRapides.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  textDecoration: "none",
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: "10px 18px",
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

        {/* Cartes modules principaux */}
        {cartesModules.length > 0 && (
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
        )}

        {/* Autres réservés */}
        {hasModuleAccess(user.roleCode, "Trésorerie") && (
          <div style={{ marginBottom: 10 }}>
            <Link
              href="/fonds-circulation"
              style={{ display: "block", textDecoration: "none", color: "#e0e0e0", background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}
            >
              💵 Fonds en circulation (§8.2)
            </Link>
          </div>
        )}
        {peutAffaires && (
          <div style={{ marginBottom: 26 }}>
            <Link
              href="/vente-comptoir"
              style={{ display: "block", textDecoration: "none", color: "#e0e0e0", background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}
            >
              🧾 Poste de vente comptoir — résiste aux coupures internet (§3.3)
            </Link>
          </div>
        )}

        {/* Tous les modules */}
        <div>
          <h2 style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>
            Tous les modules ({modules.length})
          </h2>
          {modules.length === 0 ? (
            <p style={{ fontSize: 13, color: "#888" }}>Aucun module — ce rôle n&apos;a pas de compte applicatif prévu.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
              {modules.map((m) => {
                const href = MODULE_ROUTES[m];
                const style: React.CSSProperties = {
                  display: "block",
                  textDecoration: "none",
                  color: href ? "#e0e0e0" : "#666",
                  background: "#151515",
                  border: "1px solid #2a2a2a",
                  borderRadius: 8,
                  padding: "9px 12px",
                  fontSize: 12.5,
                };
                return href ? (
                  <Link key={m} href={href} style={style}>
                    {m}
                  </Link>
                ) : (
                  <div key={m} style={style}>
                    {m}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
