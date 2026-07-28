import { sql } from "drizzle-orm";
import {
  pgTable,
  pgView,
  serial,
  bigserial,
  varchar,
  char,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  uuid,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

// Traduction Drizzle du schéma SQL de référence — CAHIER_DES_CHARGES.md §4 (v2, corrigé 2026-07-27).
// Respecter l'ordre des sections tel que documenté là-bas pour toute évolution manuelle.

// §4.1 — Identité / Droits
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 30 }).notNull().unique(),
  libelle: varchar("libelle", { length: 60 }).notNull(),
});

export const utilisateurs = pgTable("utilisateurs", {
  id: serial("id").primaryKey(),
  nom: varchar("nom", { length: 100 }).notNull(),
  telephone: varchar("telephone", { length: 20 }).notNull().unique(),
  pinHash: text("pin_hash").notNull(),
  roleId: integer("role_id")
    .notNull()
    .references(() => roles.id),
  actif: boolean("actif").notNull().default(true),
});

// §4.2 — Clients
export const clients = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    typeClient: varchar("type_client", { length: 20 }).notNull(),
    nom: varchar("nom", { length: 150 }).notNull(),
    contact: varchar("contact", { length: 150 }),
    contratRef: varchar("contrat_ref", { length: 60 }),
    paiementDiffereJours: integer("paiement_differe_jours"),
  },
  (table) => [
    check(
      "clients_type_client_check",
      sql`${table.typeClient} in ('BOUTIQUE','ONG_CONTRAT')`
    ),
  ]
);

// AJOUT 2026-07-28 : catégorisation légère par branche (§1 Vision) — pas du multi-tenant,
// juste un tag de reporting orthogonal aux 5 familles (§5). Assignation manuelle par article.
export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(), // EVOLUTECH, EVOLUTEX, EVOLUCOM
  nom: varchar("nom", { length: 60 }).notNull(),
});

// §4.3 — Articles, Variantes, Lots, Mouvements de stock
export const articles = pgTable(
  "articles",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 30 }).notNull().unique(),
    nom: varchar("nom", { length: 150 }).notNull(),
    famille: char("famille", { length: 1 }).notNull(),
    brancheId: integer("branche_id").references(() => branches.id), // NULL = non catégorisé encore
    // A: Textile/douzaine · B: Unité simple · C: Service · D: Fabrication sur commande · E: Kit
    prixVente: numeric("prix_vente", { precision: 12, scale: 2 }).notNull(),
    pmp: numeric("pmp", { precision: 12, scale: 2 }).notNull().default("0"),
    aVariantes: boolean("a_variantes").notNull().default(false),
    // publie_boutique : article visible sur "Nos produits" — jamais vrai pour une variante réserve détail (règle app-level)
    publieBoutique: boolean("publie_boutique").notNull().default(false),
    // AJOUT 2026-07-28 : photo par défaut/de repli de l'article (§10 — l'expérience visuelle est
    // jugée centrale, confirmé par le client). URL vers le stockage objet (§3.2) ; peut rester NULL
    // pour les familles sans photo pertinente (C/D), l'UI retombe alors sur une icône de famille.
    photoUrl: text("photo_url"),
    // AJOUT 2026-07-28 : Famille E (Kit) uniquement — décide si la vente déclenche un Ordre de
    // Fabrication (§8.1 point 4). Sans effet pour les autres familles (D déclenche toujours un OF).
    necessiteAssemblage: boolean("necessite_assemblage").notNull().default(false),
  },
  (table) => [
    check("articles_famille_check", sql`${table.famille} in ('A','B','C','D','E')`),
  ]
);

export const variantes = pgTable(
  "variantes",
  {
    id: serial("id").primaryKey(),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    taille: varchar("taille", { length: 20 }), // NULL = "variante par défaut" (Famille B sans déclinaison)
    couleur: varchar("couleur", { length: 30 }),
    seuilAlerte: integer("seuil_alerte").notNull().default(0),
    // AJOUT 2026-07-28 : photo propre à cette couleur (§10 — "vraie photo produit par couleur").
    // NULL = retombe sur articles.photoUrl côté UI, pas de duplication de logique en base.
    photoUrl: text("photo_url"),
  },
  (table) => [
    // Deux index partiels au lieu d'un UNIQUE simple : en PostgreSQL, deux NULL ne sont jamais égaux
    // pour une contrainte UNIQUE — sans ça, rien n'empêche deux "variantes par défaut" pour un même article.
    uniqueIndex("uq_variante_defaut")
      .on(table.articleId)
      .where(sql`${table.taille} is null and ${table.couleur} is null`),
    uniqueIndex("uq_variante_taille_couleur")
      .on(table.articleId, table.taille, table.couleur)
      .where(sql`${table.taille} is not null or ${table.couleur} is not null`),
  ]
);

export const lots = pgTable("lots", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id),
  reference: varchar("reference", { length: 40 }),
  dateReception: timestamp("date_reception").notNull().defaultNow(),
  prixAchatUnitaire: numeric("prix_achat_unitaire", {
    precision: 12,
    scale: 2,
  }).notNull(),
  // Suppression possible (droit de retour sur erreur de saisie) uniquement si aucune de ses
  // lot_variantes n'a encore été vendue/libérée — contrôle app-level, pas de colonne dédiée.
});

export const lotVariantes = pgTable(
  "lot_variantes",
  {
    id: serial("id").primaryKey(),
    lotId: integer("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "cascade" }),
    varianteId: integer("variante_id")
      .notNull()
      .references(() => variantes.id),
    quantiteProduite: integer("quantite_produite").notNull(),
  },
  (table) => [
    uniqueIndex("uq_lot_variante").on(table.lotId, table.varianteId),
    check(
      "lot_variantes_quantite_check",
      sql`${table.quantiteProduite} >= 0`
    ),
  ]
);

// Modèle v2 (corrigé 2026-07-27) : pool explicite (GROS/DETAIL) au lieu d'encoder le pool dans le
// type, qui provoquait un double comptage/omission sur les transferts entre pools. Un transfert
// (RESERVATION/LIBERATION) s'écrit en 2 lignes liées par transfertRef, une par pool impacté.
export const stockMouvements = pgTable(
  "stock_mouvements",
  {
    id: serial("id").primaryKey(),
    varianteId: integer("variante_id")
      .notNull()
      .references(() => variantes.id),
    lotId: integer("lot_id").references(() => lots.id),
    pool: varchar("pool", { length: 10 }).notNull(), // GROS | DETAIL
    type: varchar("type", { length: 20 }).notNull(),
    // ENTREE (pool=GROS, +N) · VENTE (-N) · RESERVATION (2 lignes: GROS -N + DETAIL +N)
    // LIBERATION (2 lignes: DETAIL -N + GROS +N) · AJUSTEMENT (correction motivée)
    quantite: integer("quantite").notNull(), // signé
    transfertRef: uuid("transfert_ref"), // lie les 2 lignes d'une RESERVATION/LIBERATION
    affaireId: integer("affaire_id"), // si type = VENTE ; FK ajoutée après création de `affaires`
    auteurId: integer("auteur_id")
      .notNull()
      .references(() => utilisateurs.id),
    dateMouvement: timestamp("date_mouvement").notNull().defaultNow(),
  },
  (table) => [
    check("stock_mouvements_pool_check", sql`${table.pool} in ('GROS','DETAIL')`),
    check(
      "stock_mouvements_type_check",
      sql`${table.type} in ('ENTREE','VENTE','RESERVATION','LIBERATION','AJUSTEMENT')`
    ),
  ]
);

// Vue de lecture du stock par variante — DDL gérée à la main (voir migration 0001), pas par
// drizzle-kit : chaque ligne de stock_mouvements porte déjà son pool, donc plus de recomposition
// par filtrage de type. Déclarée `.existing()` ici uniquement pour un accès typé en lecture.
export const vStockVariante = pgView("v_stock_variante", {
  varianteId: integer("variante_id"),
  articleId: integer("article_id"),
  reserveDetail: integer("reserve_detail"),
  stockDetail: integer("stock_detail"),
  stockGros: integer("stock_gros"),
  stockTotal: integer("stock_total"),
}).existing();

// §4.4 — Kits (composants de recette)
export const kitComposants = pgTable(
  "kit_composants",
  {
    id: serial("id").primaryKey(),
    kitArticleId: integer("kit_article_id")
      .notNull()
      .references(() => articles.id), // famille = 'E'
    composantArticleId: integer("composant_article_id")
      .notNull()
      .references(() => articles.id),
    // OBLIGATOIRE si composant textile (contrainte métier validée en appli, pas en DB)
    varianteId: integer("variante_id").references(() => variantes.id),
    quantiteRequise: integer("quantite_requise").notNull(),
  },
  (table) => [
    check("kit_composants_quantite_check", sql`${table.quantiteRequise} > 0`),
    check(
      "kit_composants_distinct_check",
      sql`${table.kitArticleId} <> ${table.composantArticleId}`
    ),
  ]
);

// §4.5 — Commandes, Affaires, Lignes, Règlements, Ordres de Fabrication
export const affaires = pgTable(
  "affaires",
  {
    id: serial("id").primaryKey(),
    // Un seul numéro par affaire, préfixé par type (DEV-/BC-/FACT-/TIC-/AVR-/CDE-) — "Commande"
    // au sens module (§8.1) est une vue/statut, pas un espace de numérotation séparé.
    numero: varchar("numero", { length: 20 }).notNull().unique(),
    type: varchar("type", { length: 20 }).notNull(),
    statut: varchar("statut", { length: 20 }).notNull().default("EN_COURS"),
    modeFinalisation: varchar("mode_finalisation", { length: 20 }), // RETRAIT | LIVRAISON
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    devisParentId: integer("devis_parent_id"),
    version: integer("version").notNull().default(1),
    affaireOrigineId: integer("affaire_origine_id"),
    montantTtc: numeric("montant_ttc", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    dateCreation: timestamp("date_creation").notNull().defaultNow(),
    auteurId: integer("auteur_id")
      .notNull()
      .references(() => utilisateurs.id),
    immuable: boolean("immuable").notNull().default(false),
  },
  (table) => [
    check(
      "affaires_type_check",
      sql`${table.type} in ('COMMANDE_ATTENTE','DEVIS','PROFORMA','BON_COMMANDE','TICKET','FACTURE','AVOIR')`
    ),
    check(
      "affaires_statut_check",
      sql`${table.statut} in ('EN_ATTENTE','EN_COURS','VALIDEE','CLOTUREE','ANNULEE')`
    ),
    check(
      "affaires_mode_finalisation_check",
      sql`${table.modeFinalisation} is null or ${table.modeFinalisation} in ('RETRAIT','LIVRAISON')`
    ),
  ]
);

export const lignesAffaire = pgTable(
  "lignes_affaire",
  {
    id: serial("id").primaryKey(),
    affaireId: integer("affaire_id")
      .notNull()
      .references(() => affaires.id, { onDelete: "cascade" }),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id),
    varianteId: integer("variante_id").references(() => variantes.id),
    quantite: integer("quantite").notNull(),
    prixUnitaire: numeric("prix_unitaire", { precision: 12, scale: 2 }).notNull(),
    // AJOUT 2026-07-28 : Famille D uniquement — capturé à la vente, décide si l'OF généré passe
    // par l'étape Conception (nouveau visuel/design) ou va directement en Production (modèle
    // standard déjà validé). Sans effet pour les autres familles.
    personnalise: boolean("personnalise").notNull().default(true),
  },
  (table) => [check("lignes_affaire_quantite_check", sql`${table.quantite} > 0`)]
);

export const reglements = pgTable(
  "reglements",
  {
    id: serial("id").primaryKey(),
    affaireId: integer("affaire_id")
      .notNull()
      .references(() => affaires.id),
    montant: numeric("montant", { precision: 12, scale: 2 }).notNull(),
    mode: varchar("mode", { length: 20 }).notNull(), // ESPECES | MOBILE_MONEY | VIREMENT | CARTE
    dateReglement: timestamp("date_reglement").notNull().defaultNow(),
    auteurId: integer("auteur_id")
      .notNull()
      .references(() => utilisateurs.id),
  },
  (table) => [
    check(
      "reglements_mode_check",
      sql`${table.mode} in ('ESPECES','MOBILE_MONEY','VIREMENT','CARTE')`
    ),
  ]
  // Solde = affaires.montant_ttc - SUM(reglements.montant)
);

export const ordresFabrication = pgTable(
  "ordres_fabrication",
  {
    id: serial("id").primaryKey(),
    affaireId: integer("affaire_id")
      .notNull()
      .references(() => affaires.id),
    ligneAffaireId: integer("ligne_affaire_id")
      .notNull()
      .references(() => lignesAffaire.id),
    // CORRECTION 2026-07-28 : "Conception" comme point d'entrée universel n'avait pas de sens
    // (un Kit assemblé ou une réédition standard ne se "conçoivent" pas) — "Réception" est le
    // point d'entrée réel (validation de l'affaire), Conception devient une étape optionnelle
    // (voir `personnalise`), et "Prêt" remplace "Livraison" : le Retrait/Livraison reste le
    // Commandes (§8.1), pas dupliqué ici.
    etape: varchar("etape", { length: 20 }).notNull().default("RECEPTION"),
    // Copié depuis lignes_affaire.personnalise au moment de la création — décide si cet OF passe
    // par Conception (true) ou va directement de Réception à Production (false, ex. Kit).
    personnalise: boolean("personnalise").notNull().default(true),
    piloteId: integer("pilote_id").references(() => utilisateurs.id),
    dateCreation: timestamp("date_creation").notNull().defaultNow(),
  },
  (table) => [
    check(
      "ordres_fabrication_etape_check",
      sql`${table.etape} in ('RECEPTION','CONCEPTION','PRODUCTION','CONTROLE_QUALITE','PRET')`
    ),
  ]
);

// Sous-enregistrement Livraison, uniquement si affaires.mode_finalisation = 'LIVRAISON' (§8.1)
export const livraisons = pgTable(
  "livraisons",
  {
    id: serial("id").primaryKey(),
    numero: varchar("numero", { length: 20 }).notNull().unique(), // ex LIV-26-0001
    affaireId: integer("affaire_id")
      .notNull()
      .references(() => affaires.id),
    livreurId: integer("livreur_id").references(() => utilisateurs.id), // rôle LIVREUR ou LIVREUR_PARTENAIRE
    statut: varchar("statut", { length: 20 }).notNull().default("EN_ATTENTE"),
    adresse: text("adresse"),
    dateCreation: timestamp("date_creation").notNull().defaultNow(),
  },
  (table) => [
    check(
      "livraisons_statut_check",
      sql`${table.statut} in ('EN_ATTENTE','PRIS_EN_CHARGE','EN_ROUTE','LIVREE','ECHEC')`
    ),
  ]
);

// §4.6 — Trésorerie
export const bonsDecaissement = pgTable(
  "bons_decaissement",
  {
    id: serial("id").primaryKey(),
    categorie: varchar("categorie", { length: 20 }).notNull(),
    montant: numeric("montant", { precision: 12, scale: 2 }).notNull(),
    motif: text("motif").notNull(),
    auteurId: integer("auteur_id")
      .notNull()
      .references(() => utilisateurs.id),
    validateurId: integer("validateur_id").references(() => utilisateurs.id), // requis si montant > seuil (§16.7, seuil pas encore modélisé)
    dateCreation: timestamp("date_creation").notNull().defaultNow(),
  },
  (table) => [
    check(
      "bons_decaissement_categorie_check",
      sql`${table.categorie} in ('ACHAT_MARCHANDISE','CHARGE_GENERAL','RH_SALAIRE')`
    ),
  ]
);

export const cloturesCaisse = pgTable("clotures_caisse", {
  id: serial("id").primaryKey(),
  dateCloture: date("date_cloture").notNull().unique(),
  soldeTheorique: numeric("solde_theorique", { precision: 12, scale: 2 }).notNull(),
  comptageReel: numeric("comptage_reel", { precision: 12, scale: 2 }).notNull(),
  ecart: numeric("ecart", { precision: 12, scale: 2 }).generatedAlwaysAs(
    (): ReturnType<typeof sql> => sql`comptage_reel - solde_theorique`
  ),
  justification: text("justification"),
  auteurId: integer("auteur_id")
    .notNull()
    .references(() => utilisateurs.id),
});

// Sert aussi bien le Livreur interne que le Livreur partenaire externe (§6)
export const fondsCirculation = pgTable(
  "fonds_circulation",
  {
    id: serial("id").primaryKey(),
    livreurId: integer("livreur_id")
      .notNull()
      .references(() => utilisateurs.id),
    affaireId: integer("affaire_id")
      .notNull()
      .references(() => affaires.id),
    montantAttendu: numeric("montant_attendu", { precision: 12, scale: 2 }).notNull(),
    statut: varchar("statut", { length: 20 }).notNull().default("EN_CIRCULATION"),
    montantRemis: numeric("montant_remis", { precision: 12, scale: 2 }),
    validateurId: integer("validateur_id").references(() => utilisateurs.id),
    dateRemise: timestamp("date_remise"),
  },
  (table) => [
    check(
      "fonds_circulation_statut_check",
      sql`${table.statut} in ('EN_CIRCULATION','VALIDE')`
    ),
  ]
);

// §4.7 — Stock détail vs stock gros : seuil configurable (par article ou global)
export const parametresVenteGros = pgTable("parametres_vente_gros", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").references(() => articles.id), // NULL = valeur par défaut globale
  seuilDouzaines: integer("seuil_douzaines").notNull().default(1),
  modifiePar: integer("modifie_par")
    .notNull()
    .references(() => utilisateurs.id),
  dateModification: timestamp("date_modification").notNull().defaultNow(),
});

// §4.8 — Validation vente au détail — demandes admin
export const demandesValidationStock = pgTable(
  "demandes_validation_stock",
  {
    id: serial("id").primaryKey(),
    // Affaire (COMMANDE_ATTENTE) bloquée, à reprendre après décision — absent en v1, corrigé en v2.
    affaireId: integer("affaire_id")
      .notNull()
      .references(() => affaires.id),
    varianteId: integer("variante_id")
      .notNull()
      .references(() => variantes.id),
    quantiteDemandee: integer("quantite_demandee").notNull(),
    manque: integer("manque").notNull(),
    canal: varchar("canal", { length: 20 }).notNull(), // BOUTIQUE | EN_LIGNE
    demandeurId: integer("demandeur_id")
      .notNull()
      .references(() => utilisateurs.id),
    statut: varchar("statut", { length: 20 }).notNull().default("EN_ATTENTE"),
    quantiteRechargee: integer("quantite_rechargee"),
    traiteParId: integer("traite_par_id").references(() => utilisateurs.id),
    dateCreation: timestamp("date_creation").notNull().defaultNow(),
    dateTraitement: timestamp("date_traitement"),
  },
  (table) => [
    check(
      "demandes_validation_stock_canal_check",
      sql`${table.canal} in ('BOUTIQUE','EN_LIGNE')`
    ),
    check(
      "demandes_validation_stock_statut_check",
      sql`${table.statut} in ('EN_ATTENTE','AUTORISEE','RECHARGEE','REFUSEE')`
    ),
  ]
);

// §4.9 — Documents archivés, Journal d'audit
export const documentsArchives = pgTable("documents_archives", {
  id: serial("id").primaryKey(),
  affaireId: integer("affaire_id")
    .notNull()
    .references(() => affaires.id),
  type: varchar("type", { length: 20 }).notNull(),
  fichierPath: text("fichier_path").notNull(),
  hashIntegrite: varchar("hash_integrite", { length: 64 }).notNull(), // SHA-256, garantit l'immuabilité
  qrPayload: text("qr_payload"), // contenu encodé dans le QR (suivi commande + messages, §11)
  dateEmission: timestamp("date_emission").notNull().defaultNow(),
});

// Append-only : aucun UPDATE/DELETE autorisé (appliqué en base via GRANT restreint / trigger REVOKE,
// à mettre en place lors de la migration — pas modélisable directement dans Drizzle).
export const journalAudit = pgTable("journal_audit", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  tableCible: varchar("table_cible", { length: 60 }).notNull(),
  enregistrementId: integer("enregistrement_id").notNull(),
  action: varchar("action", { length: 20 }).notNull(), // CREATION, MODIFICATION, SUPPRESSION, VALIDATION
  utilisateurId: integer("utilisateur_id")
    .notNull()
    .references(() => utilisateurs.id),
  details: jsonb("details"),
  dateAction: timestamp("date_action").notNull().defaultNow(),
});
