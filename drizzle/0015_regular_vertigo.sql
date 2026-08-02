CREATE TABLE "frais_numeriques" (
	"id" serial PRIMARY KEY NOT NULL,
	"libelle" varchar(150) NOT NULL,
	"categorie" varchar(20) NOT NULL,
	"devise" varchar(4) NOT NULL,
	"montant" numeric(12, 2) NOT NULL,
	"frequence" varchar(10) NOT NULL,
	"statut" varchar(10) DEFAULT 'PREVU' NOT NULL,
	"notes" text,
	"auteur_id" integer,
	"date_creation" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "frais_numeriques_categorie_check" CHECK ("frais_numeriques"."categorie" in ('DOMAINE','HEBERGEMENT','OUTILS_IA','PAIEMENT_LIGNE','BOUTIQUE','AUTRE')),
	CONSTRAINT "frais_numeriques_devise_check" CHECK ("frais_numeriques"."devise" in ('USD','FCFA')),
	CONSTRAINT "frais_numeriques_frequence_check" CHECK ("frais_numeriques"."frequence" in ('UNIQUE','MENSUEL','ANNUEL')),
	CONSTRAINT "frais_numeriques_statut_check" CHECK ("frais_numeriques"."statut" in ('PREVU','ACTIF'))
);
--> statement-breakpoint
ALTER TABLE "frais_numeriques" ADD CONSTRAINT "frais_numeriques_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;