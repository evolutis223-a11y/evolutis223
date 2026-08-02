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
  ["AGENT_MARKETING", "Agent marketing"],
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
  { nom: "Compte de test — Agent marketing", telephone: "+22300000005", pin: "1234", roleCode: "AGENT_MARKETING" },
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

  // Parcours maquette public (§10ter) — dispositions par défaut, reprises telles quelles de
  // l'artefact validé le 2026-07-29 (LAYOUTS), harmonisées/centrées, jamais verrouillées par défaut.
  const { rows: dispoCount } = await pool.query("select count(*)::int as n from dispositions_maquette");
  if (dispoCount[0].n === 0) {
    await pool.query(
      `insert into dispositions_maquette (nb_elements, positions, verrouille) values
       (3, $1, false), (4, $2, false), (6, $3, false)`,
      [
        JSON.stringify([[32, 14], [32, 50], [32, 86]]),
        JSON.stringify([[20, 16], [44, 16], [20, 84], [44, 84]]),
        JSON.stringify([[20, 10], [44, 10], [20, 50], [44, 50], [20, 90], [44, 90]]),
      ]
    );
    console.log("3 dispositions maquette par défaut seedées (3/4/6 éléments).");
  }

  const { rows: parcoursParamCount } = await pool.query("select count(*)::int as n from parametres_parcours_maquette");
  if (parcoursParamCount[0].n === 0) {
    await pool.query("insert into parametres_parcours_maquette (badge_forme, badge_taille) values ('circle', 1)");
    console.log("Paramètres parcours maquette par défaut seedés (médaillon cercle, taille 100%).");
  }

  // §3.3/§10 — Compte technique utilisé comme auteurId des commandes créées par le configurateur
  // public (décision utilisateur 2026-07-31 : commande directe, pas de file d'attente). actif=false
  // pour bloquer toute connexion interactive — sert uniquement de référence FK, jamais de login réel.
  {
    const pinHash = await bcrypt.hash(String(Math.random()).slice(2), 10);
    await pool.query(
      `insert into utilisateurs (nom, telephone, pin_hash, role_id, actif)
       select 'Configurateur en ligne (technique)', '+22300000098', $1, id, false from roles where code = 'VENDEUR'
       on conflict (telephone) do nothing`,
      [pinHash]
    );
    console.log("Compte technique configurateur en ligne seedé (+22300000098, inactif — FK uniquement).");
  }

  // §10 point 3 — Finitions du chemin long, surcharges fixes de la maquette validée (2026-07-28),
  // éditables ensuite dans /configurateur-admin.
  const { rows: finitionCount } = await pool.query("select count(*)::int as n from finitions_configurateur");
  if (finitionCount[0].n === 0) {
    await pool.query(`insert into finitions_configurateur (nom, montant, ordre) values
      ('Broderie relief 3D (au lieu de broderie plate)', 800, 1),
      ('Patch tissé cousu (au lieu de brodé directement)', 500, 2),
      ('Étiquette personnalisée (col ou ourlet)', 300, 3),
      ('Emballage individuel (pochette + pliage soigné)', 150, 4)`);
    console.log("4 finitions par défaut seedées.");
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
