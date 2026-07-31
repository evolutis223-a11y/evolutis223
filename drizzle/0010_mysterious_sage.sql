CREATE TABLE "demandes_maquette" (
	"id" serial PRIMARY KEY NOT NULL,
	"numero" varchar(20) NOT NULL,
	"statut" varchar(20) DEFAULT 'EN_ATTENTE' NOT NULL,
	"nom_client" varchar(150) NOT NULL,
	"telephone_client" varchar(20) NOT NULL,
	"adresse_client" text,
	"intent" varchar(20) NOT NULL,
	"details" jsonb NOT NULL,
	"forfait_article_id" integer,
	"date_creation" timestamp DEFAULT now() NOT NULL,
	"traite_par_id" integer,
	"date_traitement" timestamp,
	"affaire_creee_id" integer,
	CONSTRAINT "demandes_maquette_numero_unique" UNIQUE("numero"),
	CONSTRAINT "demandes_maquette_statut_check" CHECK ("demandes_maquette"."statut" in ('EN_ATTENTE','VALIDEE','REFUSEE')),
	CONSTRAINT "demandes_maquette_intent_check" CHECK ("demandes_maquette"."intent" in ('maquette','pagne'))
);
--> statement-breakpoint
CREATE TABLE "dispositions_maquette" (
	"nb_elements" integer PRIMARY KEY NOT NULL,
	"positions" jsonb NOT NULL,
	"verrouille" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modeles_maquette" (
	"id" serial PRIMARY KEY NOT NULL,
	"blob_url" text NOT NULL,
	"tag" varchar(20),
	"actif" boolean DEFAULT true NOT NULL,
	"date_ajout" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parametres_parcours_maquette" (
	"id" serial PRIMARY KEY NOT NULL,
	"badge_forme" varchar(10) DEFAULT 'circle' NOT NULL,
	"badge_taille" numeric(3, 2) DEFAULT '1' NOT NULL,
	"modifie_par" integer,
	"date_modification" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "demandes_maquette" ADD CONSTRAINT "demandes_maquette_forfait_article_id_articles_id_fk" FOREIGN KEY ("forfait_article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes_maquette" ADD CONSTRAINT "demandes_maquette_traite_par_id_utilisateurs_id_fk" FOREIGN KEY ("traite_par_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes_maquette" ADD CONSTRAINT "demandes_maquette_affaire_creee_id_affaires_id_fk" FOREIGN KEY ("affaire_creee_id") REFERENCES "public"."affaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parametres_parcours_maquette" ADD CONSTRAINT "parametres_parcours_maquette_modifie_par_utilisateurs_id_fk" FOREIGN KEY ("modifie_par") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;