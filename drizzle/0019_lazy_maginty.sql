CREATE TABLE "avances_personnel" (
	"id" serial PRIMARY KEY NOT NULL,
	"personnel_id" integer NOT NULL,
	"montant" numeric(12, 2) NOT NULL,
	"date" date NOT NULL,
	"statut" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"auteur_id" integer NOT NULL,
	CONSTRAINT "avances_personnel_statut_check" CHECK ("avances_personnel"."statut" in ('ACTIVE','SOLDEE'))
);
--> statement-breakpoint
CREATE TABLE "prets_personnel" (
	"id" serial PRIMARY KEY NOT NULL,
	"personnel_id" integer NOT NULL,
	"montant" numeric(12, 2) NOT NULL,
	"mensualite" numeric(12, 2) NOT NULL,
	"solde_restant" numeric(12, 2) NOT NULL,
	"statut" varchar(20) DEFAULT 'ACTIF' NOT NULL,
	"date_creation" timestamp DEFAULT now() NOT NULL,
	"auteur_id" integer NOT NULL,
	CONSTRAINT "prets_personnel_statut_check" CHECK ("prets_personnel"."statut" in ('ACTIF','SOLDE'))
);
--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "matricule" varchar(20);--> statement-breakpoint
UPDATE "personnel" SET "matricule" = 'EMP-' || lpad("id"::text, 4, '0') WHERE "matricule" IS NULL;--> statement-breakpoint
ALTER TABLE "personnel" ALTER COLUMN "matricule" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "email" varchar(150);--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "departement" varchar(100);--> statement-breakpoint
ALTER TABLE "personnel" ADD COLUMN "duree_contrat" varchar(20);--> statement-breakpoint
ALTER TABLE "avances_personnel" ADD CONSTRAINT "avances_personnel_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avances_personnel" ADD CONSTRAINT "avances_personnel_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prets_personnel" ADD CONSTRAINT "prets_personnel_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prets_personnel" ADD CONSTRAINT "prets_personnel_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_matricule_unique" UNIQUE("matricule");--> statement-breakpoint
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_duree_contrat_check" CHECK ("personnel"."duree_contrat" is null or "personnel"."duree_contrat" in ('CDI','CDD','Stagiaire'));