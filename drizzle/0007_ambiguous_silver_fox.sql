CREATE TABLE "cadres_serigraphie" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" varchar(50) NOT NULL,
	"prix_cadre" numeric(12, 2) NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	"actif" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "encres_marquage" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" varchar(100) NOT NULL,
	"technique" varchar(20) NOT NULL,
	"prix_reference" numeric(12, 2) NOT NULL,
	"volume_reference_label" varchar(30),
	"surface_reference_cm2" numeric(10, 2) NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	CONSTRAINT "encres_marquage_technique_check" CHECK ("encres_marquage"."technique" in ('SUBLIMATION','DTF'))
);
--> statement-breakpoint
CREATE TABLE "paliers_broderie" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" varchar(60) NOT NULL,
	"prix" numeric(12, 2) NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	"actif" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parametres_marquage" (
	"id" serial PRIMARY KEY NOT NULL,
	"main_oeuvre_defaut" numeric(12, 2) DEFAULT '200' NOT NULL,
	"marge_defaut" numeric(12, 2) DEFAULT '300' NOT NULL,
	"modifie_par" integer,
	"date_modification" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supports_marquage" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" varchar(100) NOT NULL,
	"technique" varchar(20) NOT NULL,
	"prix" numeric(12, 2) NOT NULL,
	"largeur_cm" numeric(8, 2) NOT NULL,
	"hauteur_cm" numeric(8, 2) NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	CONSTRAINT "supports_marquage_technique_check" CHECK ("supports_marquage"."technique" in ('SUBLIMATION','DTF','FLOCAGE'))
);
--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "categorie_marquage" varchar(20);--> statement-breakpoint
ALTER TABLE "lignes_affaire" ADD COLUMN "config_marquage" jsonb;--> statement-breakpoint
ALTER TABLE "parametres_marquage" ADD CONSTRAINT "parametres_marquage_modifie_par_utilisateurs_id_fk" FOREIGN KEY ("modifie_par") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_categorie_marquage_check" CHECK ("articles"."categorie_marquage" is null or "articles"."categorie_marquage" in ('ENSEMBLE','TISSU'));