CREATE TABLE "demandes_acces" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" varchar(100) NOT NULL,
	"telephone" varchar(20) NOT NULL,
	"pin_hash" text NOT NULL,
	"poste_vise" varchar(100),
	"statut" varchar(20) DEFAULT 'EN_ATTENTE' NOT NULL,
	"date_creation" timestamp DEFAULT now() NOT NULL,
	"traite_par_id" integer,
	"date_traitement" timestamp,
	"utilisateur_cree_id" integer,
	CONSTRAINT "demandes_acces_statut_check" CHECK ("demandes_acces"."statut" in ('EN_ATTENTE','VALIDEE','REFUSEE'))
);
--> statement-breakpoint
ALTER TABLE "demandes_acces" ADD CONSTRAINT "demandes_acces_traite_par_id_utilisateurs_id_fk" FOREIGN KEY ("traite_par_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandes_acces" ADD CONSTRAINT "demandes_acces_utilisateur_cree_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_cree_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;