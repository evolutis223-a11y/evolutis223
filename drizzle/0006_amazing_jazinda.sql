CREATE TABLE "parametres_tresorerie" (
	"id" serial PRIMARY KEY NOT NULL,
	"seuil_validation_decaissement" numeric(12, 2) DEFAULT '50000' NOT NULL,
	"modifie_par" integer,
	"date_modification" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parametres_tresorerie" ADD CONSTRAINT "parametres_tresorerie_modifie_par_utilisateurs_id_fk" FOREIGN KEY ("modifie_par") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;