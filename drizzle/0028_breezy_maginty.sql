CREATE TABLE "avis_site" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" varchar(100) NOT NULL,
	"message" text NOT NULL,
	"statut" varchar(12) DEFAULT 'EN_ATTENTE' NOT NULL,
	"date_creation" timestamp DEFAULT now() NOT NULL,
	"traite_par" integer,
	CONSTRAINT "avis_site_statut_check" CHECK ("avis_site"."statut" in ('EN_ATTENTE','APPROUVE','REJETE'))
);
--> statement-breakpoint
CREATE TABLE "messages_contact" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" varchar(100) NOT NULL,
	"contact" varchar(100),
	"message" text NOT NULL,
	"lu" boolean DEFAULT false NOT NULL,
	"date_creation" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "avis_site" ADD CONSTRAINT "avis_site_traite_par_utilisateurs_id_fk" FOREIGN KEY ("traite_par") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;