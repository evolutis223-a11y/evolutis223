CREATE TABLE "affaires" (
	"id" serial PRIMARY KEY NOT NULL,
	"numero" varchar(20) NOT NULL,
	"type" varchar(20) NOT NULL,
	"statut" varchar(20) DEFAULT 'EN_COURS' NOT NULL,
	"mode_finalisation" varchar(20),
	"client_id" integer NOT NULL,
	"devis_parent_id" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"affaire_origine_id" integer,
	"montant_ttc" numeric(12, 2) DEFAULT '0' NOT NULL,
	"date_creation" timestamp DEFAULT now() NOT NULL,
	"auteur_id" integer NOT NULL,
	"immuable" boolean DEFAULT false NOT NULL,
	CONSTRAINT "affaires_numero_unique" UNIQUE("numero"),
	CONSTRAINT "affaires_type_check" CHECK ("affaires"."type" in ('COMMANDE_ATTENTE','DEVIS','PROFORMA','BON_COMMANDE','TICKET','FACTURE','AVOIR')),
	CONSTRAINT "affaires_statut_check" CHECK ("affaires"."statut" in ('EN_ATTENTE','EN_COURS','VALIDEE','CLOTUREE','ANNULEE')),
	CONSTRAINT "affaires_mode_finalisation_check" CHECK ("affaires"."mode_finalisation" is null or "affaires"."mode_finalisation" in ('RETRAIT','LIVRAISON'))
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(30) NOT NULL,
	"nom" varchar(150) NOT NULL,
	"famille" char(1) NOT NULL,
	"prix_vente" numeric(12, 2) NOT NULL,
	"pmp" numeric(12, 2) DEFAULT '0' NOT NULL,
	"a_variantes" boolean DEFAULT false NOT NULL,
	"publie_boutique" boolean DEFAULT false NOT NULL,
	CONSTRAINT "articles_code_unique" UNIQUE("code"),
	CONSTRAINT "articles_famille_check" CHECK ("articles"."famille" in ('A','B','C','D','E'))
);
--> statement-breakpoint
CREATE TABLE "bons_decaissement" (
	"id" serial PRIMARY KEY NOT NULL,
	"categorie" varchar(20) NOT NULL,
	"montant" numeric(12, 2) NOT NULL,
	"motif" text NOT NULL,
	"auteur_id" integer NOT NULL,
	"validateur_id" integer,
	"date_creation" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bons_decaissement_categorie_check" CHECK ("bons_decaissement"."categorie" in ('ACHAT_MARCHANDISE','CHARGE_GENERAL','RH_SALAIRE'))
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"type_client" varchar(20) NOT NULL,
	"nom" varchar(150) NOT NULL,
	"contact" varchar(150),
	"contrat_ref" varchar(60),
	"paiement_differe_jours" integer,
	CONSTRAINT "clients_type_client_check" CHECK ("clients"."type_client" in ('BOUTIQUE','ONG_CONTRAT'))
);
--> statement-breakpoint
CREATE TABLE "clotures_caisse" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_cloture" date NOT NULL,
	"solde_theorique" numeric(12, 2) NOT NULL,
	"comptage_reel" numeric(12, 2) NOT NULL,
	"ecart" numeric(12, 2) GENERATED ALWAYS AS (comptage_reel - solde_theorique) STORED,
	"justification" text,
	"auteur_id" integer NOT NULL,
	CONSTRAINT "clotures_caisse_date_cloture_unique" UNIQUE("date_cloture")
);
--> statement-breakpoint
CREATE TABLE "demandes_validation_stock" (
	"id" serial PRIMARY KEY NOT NULL,
	"affaire_id" integer NOT NULL,
	"variante_id" integer NOT NULL,
	"quantite_demandee" integer NOT NULL,
	"manque" integer NOT NULL,
	"canal" varchar(20) NOT NULL,
	"demandeur_id" integer NOT NULL,
	"statut" varchar(20) DEFAULT 'EN_ATTENTE' NOT NULL,
	"quantite_rechargee" integer,
	"traite_par_id" integer,
	"date_creation" timestamp DEFAULT now() NOT NULL,
	"date_traitement" timestamp,
	CONSTRAINT "demandes_validation_stock_canal_check" CHECK ("demandes_validation_stock"."canal" in ('BOUTIQUE','EN_LIGNE')),
	CONSTRAINT "demandes_validation_stock_statut_check" CHECK ("demandes_validation_stock"."statut" in ('EN_ATTENTE','AUTORISEE','RECHARGEE','REFUSEE'))
);
--> statement-breakpoint
CREATE TABLE "documents_archives" (
	"id" serial PRIMARY KEY NOT NULL,
	"affaire_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"fichier_path" text NOT NULL,
	"hash_integrite" varchar(64) NOT NULL,
	"qr_payload" text,
	"date_emission" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fonds_circulation" (
	"id" serial PRIMARY KEY NOT NULL,
	"livreur_id" integer NOT NULL,
	"affaire_id" integer NOT NULL,
	"montant_attendu" numeric(12, 2) NOT NULL,
	"statut" varchar(20) DEFAULT 'EN_CIRCULATION' NOT NULL,
	"montant_remis" numeric(12, 2),
	"validateur_id" integer,
	"date_remise" timestamp,
	CONSTRAINT "fonds_circulation_statut_check" CHECK ("fonds_circulation"."statut" in ('EN_CIRCULATION','VALIDE'))
);
--> statement-breakpoint
CREATE TABLE "journal_audit" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"table_cible" varchar(60) NOT NULL,
	"enregistrement_id" integer NOT NULL,
	"action" varchar(20) NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"details" jsonb,
	"date_action" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kit_composants" (
	"id" serial PRIMARY KEY NOT NULL,
	"kit_article_id" integer NOT NULL,
	"composant_article_id" integer NOT NULL,
	"variante_id" integer,
	"quantite_requise" integer NOT NULL,
	CONSTRAINT "kit_composants_quantite_check" CHECK ("kit_composants"."quantite_requise" > 0),
	CONSTRAINT "kit_composants_distinct_check" CHECK ("kit_composants"."kit_article_id" <> "kit_composants"."composant_article_id")
);
--> statement-breakpoint
CREATE TABLE "lignes_affaire" (
	"id" serial PRIMARY KEY NOT NULL,
	"affaire_id" integer NOT NULL,
	"article_id" integer NOT NULL,
	"variante_id" integer,
	"quantite" integer NOT NULL,
	"prix_unitaire" numeric(12, 2) NOT NULL,
	CONSTRAINT "lignes_affaire_quantite_check" CHECK ("lignes_affaire"."quantite" > 0)
);
--> statement-breakpoint
CREATE TABLE "livraisons" (
	"id" serial PRIMARY KEY NOT NULL,
	"numero" varchar(20) NOT NULL,
	"affaire_id" integer NOT NULL,
	"livreur_id" integer,
	"statut" varchar(20) DEFAULT 'EN_ATTENTE' NOT NULL,
	"adresse" text,
	"date_creation" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "livraisons_numero_unique" UNIQUE("numero"),
	CONSTRAINT "livraisons_statut_check" CHECK ("livraisons"."statut" in ('EN_ATTENTE','PRIS_EN_CHARGE','EN_ROUTE','LIVREE','ECHEC'))
);
--> statement-breakpoint
CREATE TABLE "lot_variantes" (
	"id" serial PRIMARY KEY NOT NULL,
	"lot_id" integer NOT NULL,
	"variante_id" integer NOT NULL,
	"quantite_produite" integer NOT NULL,
	CONSTRAINT "lot_variantes_quantite_check" CHECK ("lot_variantes"."quantite_produite" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lots" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"reference" varchar(40),
	"date_reception" timestamp DEFAULT now() NOT NULL,
	"prix_achat_unitaire" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ordres_fabrication" (
	"id" serial PRIMARY KEY NOT NULL,
	"affaire_id" integer NOT NULL,
	"ligne_affaire_id" integer NOT NULL,
	"etape" varchar(20) DEFAULT 'CONCEPTION' NOT NULL,
	"pilote_id" integer,
	"date_creation" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ordres_fabrication_etape_check" CHECK ("ordres_fabrication"."etape" in ('CONCEPTION','PRODUCTION','CONTROLE_QUALITE','LIVRAISON'))
);
--> statement-breakpoint
CREATE TABLE "parametres_vente_gros" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer,
	"seuil_douzaines" integer DEFAULT 1 NOT NULL,
	"modifie_par" integer NOT NULL,
	"date_modification" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reglements" (
	"id" serial PRIMARY KEY NOT NULL,
	"affaire_id" integer NOT NULL,
	"montant" numeric(12, 2) NOT NULL,
	"mode" varchar(20) NOT NULL,
	"date_reglement" timestamp DEFAULT now() NOT NULL,
	"auteur_id" integer NOT NULL,
	CONSTRAINT "reglements_mode_check" CHECK ("reglements"."mode" in ('ESPECES','MOBILE_MONEY','VIREMENT','CARTE'))
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(30) NOT NULL,
	"libelle" varchar(60) NOT NULL,
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "stock_mouvements" (
	"id" serial PRIMARY KEY NOT NULL,
	"variante_id" integer NOT NULL,
	"lot_id" integer,
	"pool" varchar(10) NOT NULL,
	"type" varchar(20) NOT NULL,
	"quantite" integer NOT NULL,
	"transfert_ref" uuid,
	"affaire_id" integer,
	"auteur_id" integer NOT NULL,
	"date_mouvement" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_mouvements_pool_check" CHECK ("stock_mouvements"."pool" in ('GROS','DETAIL')),
	CONSTRAINT "stock_mouvements_type_check" CHECK ("stock_mouvements"."type" in ('ENTREE','VENTE','RESERVATION','LIBERATION','AJUSTEMENT'))
);
--> statement-breakpoint
CREATE TABLE "utilisateurs" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" varchar(100) NOT NULL,
	"telephone" varchar(20) NOT NULL,
	"pin_hash" text NOT NULL,
	"role_id" integer NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	CONSTRAINT "utilisateurs_telephone_unique" UNIQUE("telephone")
);
--> statement-breakpoint
CREATE TABLE "variantes" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"taille" varchar(20),
	"couleur" varchar(30),
	"seuil_alerte" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affaires" ADD CONSTRAINT "affaires_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affaires" ADD CONSTRAINT "affaires_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bons_decaissement" ADD CONSTRAINT "bons_decaissement_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bons_decaissement" ADD CONSTRAINT "bons_decaissement_validateur_id_utilisateurs_id_fk" FOREIGN KEY ("validateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clotures_caisse" ADD CONSTRAINT "clotures_caisse_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes_validation_stock" ADD CONSTRAINT "demandes_validation_stock_affaire_id_affaires_id_fk" FOREIGN KEY ("affaire_id") REFERENCES "public"."affaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes_validation_stock" ADD CONSTRAINT "demandes_validation_stock_variante_id_variantes_id_fk" FOREIGN KEY ("variante_id") REFERENCES "public"."variantes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes_validation_stock" ADD CONSTRAINT "demandes_validation_stock_demandeur_id_utilisateurs_id_fk" FOREIGN KEY ("demandeur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes_validation_stock" ADD CONSTRAINT "demandes_validation_stock_traite_par_id_utilisateurs_id_fk" FOREIGN KEY ("traite_par_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents_archives" ADD CONSTRAINT "documents_archives_affaire_id_affaires_id_fk" FOREIGN KEY ("affaire_id") REFERENCES "public"."affaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fonds_circulation" ADD CONSTRAINT "fonds_circulation_livreur_id_utilisateurs_id_fk" FOREIGN KEY ("livreur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fonds_circulation" ADD CONSTRAINT "fonds_circulation_affaire_id_affaires_id_fk" FOREIGN KEY ("affaire_id") REFERENCES "public"."affaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fonds_circulation" ADD CONSTRAINT "fonds_circulation_validateur_id_utilisateurs_id_fk" FOREIGN KEY ("validateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_composants" ADD CONSTRAINT "kit_composants_kit_article_id_articles_id_fk" FOREIGN KEY ("kit_article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_composants" ADD CONSTRAINT "kit_composants_composant_article_id_articles_id_fk" FOREIGN KEY ("composant_article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_composants" ADD CONSTRAINT "kit_composants_variante_id_variantes_id_fk" FOREIGN KEY ("variante_id") REFERENCES "public"."variantes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_affaire" ADD CONSTRAINT "lignes_affaire_affaire_id_affaires_id_fk" FOREIGN KEY ("affaire_id") REFERENCES "public"."affaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_affaire" ADD CONSTRAINT "lignes_affaire_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_affaire" ADD CONSTRAINT "lignes_affaire_variante_id_variantes_id_fk" FOREIGN KEY ("variante_id") REFERENCES "public"."variantes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "livraisons" ADD CONSTRAINT "livraisons_affaire_id_affaires_id_fk" FOREIGN KEY ("affaire_id") REFERENCES "public"."affaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "livraisons" ADD CONSTRAINT "livraisons_livreur_id_utilisateurs_id_fk" FOREIGN KEY ("livreur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lot_variantes" ADD CONSTRAINT "lot_variantes_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lot_variantes" ADD CONSTRAINT "lot_variantes_variante_id_variantes_id_fk" FOREIGN KEY ("variante_id") REFERENCES "public"."variantes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordres_fabrication" ADD CONSTRAINT "ordres_fabrication_affaire_id_affaires_id_fk" FOREIGN KEY ("affaire_id") REFERENCES "public"."affaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordres_fabrication" ADD CONSTRAINT "ordres_fabrication_ligne_affaire_id_lignes_affaire_id_fk" FOREIGN KEY ("ligne_affaire_id") REFERENCES "public"."lignes_affaire"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordres_fabrication" ADD CONSTRAINT "ordres_fabrication_pilote_id_utilisateurs_id_fk" FOREIGN KEY ("pilote_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parametres_vente_gros" ADD CONSTRAINT "parametres_vente_gros_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parametres_vente_gros" ADD CONSTRAINT "parametres_vente_gros_modifie_par_utilisateurs_id_fk" FOREIGN KEY ("modifie_par") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reglements" ADD CONSTRAINT "reglements_affaire_id_affaires_id_fk" FOREIGN KEY ("affaire_id") REFERENCES "public"."affaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reglements" ADD CONSTRAINT "reglements_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_mouvements" ADD CONSTRAINT "stock_mouvements_variante_id_variantes_id_fk" FOREIGN KEY ("variante_id") REFERENCES "public"."variantes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_mouvements" ADD CONSTRAINT "stock_mouvements_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_mouvements" ADD CONSTRAINT "stock_mouvements_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variantes" ADD CONSTRAINT "variantes_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_lot_variante" ON "lot_variantes" USING btree ("lot_id","variante_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_variante_defaut" ON "variantes" USING btree ("article_id") WHERE "variantes"."taille" is null and "variantes"."couleur" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_variante_taille_couleur" ON "variantes" USING btree ("article_id","taille","couleur") WHERE "variantes"."taille" is not null or "variantes"."couleur" is not null;