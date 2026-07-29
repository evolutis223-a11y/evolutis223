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

  // §10bis — Bibliothèque de références du calculateur de marquage, valeurs de la maquette
  // validée (2026-07-28) comme point de départ éditable par Admin/Super Admin.
  const { rows: encreCount } = await pool.query("select count(*)::int as n from encres_marquage");
  if (encreCount[0].n === 0) {
    await pool.query(`insert into encres_marquage (nom, technique, prix_reference, volume_reference_label, surface_reference_cm2) values
      ('Sublimation Claude', 'SUBLIMATION', 1000, '100 ml', 609),
      ('Sublimation Samba', 'SUBLIMATION', 2000, '100 ml', 609),
      ('DTF Standard', 'DTF', 3500, '100 ml', 609)`);
    console.log("3 encres de référence seedées.");
  }

  const { rows: supportCount } = await pool.query("select count(*)::int as n from supports_marquage");
  if (supportCount[0].n === 0) {
    await pool.query(`insert into supports_marquage (nom, technique, prix, largeur_cm, hauteur_cm) values
      ('Papier ordinaire', 'SUBLIMATION', 50, 29, 21),
      ('Papier spécial sublimation', 'SUBLIMATION', 150, 29, 21),
      ('Film DTF spécial', 'DTF', 400, 29, 21),
      ('Vinyle flocage standard', 'FLOCAGE', 250, 29, 21),
      ('Vinyle flocage premium (rouleau)', 'FLOCAGE', 450, 30, 30)`);
    console.log("5 supports de référence seedés.");
  }

  const { rows: cadreCount } = await pool.query("select count(*)::int as n from cadres_serigraphie");
  if (cadreCount[0].n === 0) {
    await pool.query(`insert into cadres_serigraphie (nom, prix_cadre, ordre) values
      ('1 couleur', 0, 1), ('2 couleurs', 500, 2), ('3 couleurs', 1000, 3), ('4+ couleurs', 1600, 4)`);
    console.log("4 paliers de cadres sérigraphie seedés.");
  }

  const { rows: broderieCount } = await pool.query("select count(*)::int as n from paliers_broderie");
  if (broderieCount[0].n === 0) {
    await pool.query(`insert into paliers_broderie (nom, prix, ordre) values
      ('Petit (ex. initiales)', 800, 1), ('Moyen (ex. logo poitrine)', 1500, 2), ('Grand (ex. dos complet)', 2800, 3)`);
    console.log("3 paliers de broderie seedés.");
  }

  const { rows: paramCount } = await pool.query("select count(*)::int as n from parametres_marquage");
  if (paramCount[0].n === 0) {
    await pool.query("insert into parametres_marquage (main_oeuvre_defaut, marge_defaut) values (200, 300)");
    console.log("Paramètres marquage par défaut seedés (main d'œuvre 200F, marge 300F).");
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
