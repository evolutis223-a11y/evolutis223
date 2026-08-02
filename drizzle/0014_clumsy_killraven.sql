CREATE TABLE "parametres_marketing" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_banniere" text,
	"banniere_active" boolean DEFAULT false NOT NULL,
	"modifie_par" integer,
	"date_modification" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" varchar(150) NOT NULL,
	"article_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"valeur" numeric(12, 2) NOT NULL,
	"date_debut" date NOT NULL,
	"date_fin" date NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"auteur_id" integer NOT NULL,
	"date_creation" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_type_check" CHECK ("promotions"."type" in ('POURCENTAGE','MONTANT_FIXE')),
	CONSTRAINT "promotions_dates_check" CHECK ("promotions"."date_fin" >= "promotions"."date_debut")
);
--> statement-breakpoint
ALTER TABLE "parametres_marketing" ADD CONSTRAINT "parametres_marketing_modifie_par_utilisateurs_id_fk" FOREIGN KEY ("modifie_par") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;