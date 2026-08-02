CREATE TABLE "besoins_saisonniers" (
	"id" serial PRIMARY KEY NOT NULL,
	"titre" varchar(150) NOT NULL,
	"fonction" varchar(100),
	"nombre_personnes_requis" integer DEFAULT 1 NOT NULL,
	"periode_debut" date NOT NULL,
	"periode_fin" date NOT NULL,
	"notes" text,
	"statut" varchar(20) DEFAULT 'PLANIFIE' NOT NULL,
	"auteur_id" integer NOT NULL,
	"date_creation" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "besoins_saisonniers_statut_check" CHECK ("besoins_saisonniers"."statut" in ('PLANIFIE','EN_COURS','POURVU','ANNULE'))
);
--> statement-breakpoint
CREATE TABLE "incidents_personnel" (
	"id" serial PRIMARY KEY NOT NULL,
	"personnel_id" integer NOT NULL,
	"type" varchar(30) NOT NULL,
	"date_incident" date NOT NULL,
	"description" text,
	"impact" text,
	"obligations_legales" text,
	"statut" varchar(20) DEFAULT 'DECLARE' NOT NULL,
	"auteur_id" integer NOT NULL,
	"date_creation" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "incidents_personnel_type_check" CHECK ("incidents_personnel"."type" in ('MALADIE','BLESSURE','DECES','CATASTROPHE_NATURELLE','BLOCAGE_RECRUTEMENT','AUTRE')),
	CONSTRAINT "incidents_personnel_statut_check" CHECK ("incidents_personnel"."statut" in ('DECLARE','EN_COURS','RESOLU'))
);
--> statement-breakpoint
ALTER TABLE "besoins_saisonniers" ADD CONSTRAINT "besoins_saisonniers_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents_personnel" ADD CONSTRAINT "incidents_personnel_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents_personnel" ADD CONSTRAINT "incidents_personnel_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;