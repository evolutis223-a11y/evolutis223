import "dotenv/config";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

// Rôles cibles — CAHIER_DES_CHARGES.md §6
const ROLES = [
  ["SUPER_ADMIN", "Super Admin"],
  ["ADMIN", "Admin"],
  ["MANAGER", "Manager"],
  ["COMPTABLE", "Comptable"],
  ["RESP_COMMERCIAL", "Responsable Commercial"],
  ["COMMERCIAL", "Commercial"],
  ["VENDEUR", "Vendeur"],
  ["FREELANCE", "Freelance"],
  ["JOURNALIER", "Journalier"],
  ["EMPLOYE", "Employé"],
  ["SUPPORT", "Support"],
  ["LIVREUR", "Livreur (interne)"],
  ["LIVREUR_PARTENAIRE", "Livreur partenaire (externe)"],
];

// Branches — catégorisation légère, §1 Vision
const BRANCHES = [
  ["EVOLUTECH", "EvoluTech"],
  ["EVOLUTEX", "EvoluTex"],
  ["EVOLUCOM", "EvoluCom"],
];

// Comptes de développement uniquement — PIN à changer avant toute mise en production.
const DEV_USERS = [
  { nom: "Compte de test — Super Admin", telephone: "+22300000000", pin: "1234", roleCode: "SUPER_ADMIN" },
  { nom: "Compte de test — Vendeur", telephone: "+22300000001", pin: "1234", roleCode: "VENDEUR" },
  { nom: "Compte de test — Comptable", telephone: "+22300000002", pin: "1234", roleCode: "COMPTABLE" },
  { nom: "Compte de test — Livreur", telephone: "+22300000003", pin: "1234", roleCode: "LIVREUR" },
  { nom: "Ibrahim Diarra", telephone: "+22300000004", pin: "1234", roleCode: "EMPLOYE" },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  for (const [code, libelle] of ROLES) {
    await pool.query(
      `insert into roles (code, libelle) values ($1, $2)
       on conflict (code) do update set libelle = excluded.libelle`,
      [code, libelle]
    );
  }
  console.log(`${ROLES.length} rôles seedés.`);

  for (const [code, nom] of BRANCHES) {
    await pool.query(
      `insert into branches (code, nom) values ($1, $2)
       on conflict (code) do update set nom = excluded.nom`,
      [code, nom]
    );
  }
  console.log(`${BRANCHES.length} branches seedées.`);

  for (const u of DEV_USERS) {
    const pinHash = await bcrypt.hash(u.pin, 10);
    await pool.query(
      `insert into utilisateurs (nom, telephone, pin_hash, role_id, actif)
       select $1, $2, $3, id, true from roles where code = $4
       on conflict (telephone) do update set pin_hash = excluded.pin_hash`,
      [u.nom, u.telephone, pinHash, u.roleCode]
    );
    console.log(`Compte de test créé — ${u.telephone} / PIN ${u.pin} (${u.roleCode}, dev uniquement).`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
