CREATE TABLE "bulletins_paie" (
	"id" serial PRIMARY KEY NOT NULL,
	"personnel_id" integer NOT NULL,
	"periode" varchar(7) NOT NULL,
	"salaire_base" numeric(12, 2) DEFAULT '0' NOT NULL,
	"prime_transport" numeric(12, 2) DEFAULT '0' NOT NULL,
	"commission" numeric(12, 2) DEFAULT '0' NOT NULL,
	"retenue_inps" numeric(12, 2) DEFAULT '0' NOT NULL,
	"avance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"net_a_payer" numeric(12, 2) NOT NULL,
	"statut" varchar(20) DEFAULT 'BROUILLON' NOT NULL,
	"decaissement_id" integer,
	"auteur_id" integer NOT NULL,
	"date_creation" timestamp DEFAULT now() NOT NULL,
	"date_paiement" timestamp,
	CONSTRAINT "bulletins_paie_statut_check" CHECK ("bulletins_paie"."statut" in ('BROUILLON','PAYE'))
);
--> statement-breakpoint
CREATE TABLE "personnel" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" varchar(150) NOT NULL,
	"telephone" varchar(20),
	"fonction" varchar(100),
	"type_contrat" varchar(20) NOT NULL,
	"utilisateur_id" integer,
	"salaire_base" numeric(12, 2) DEFAULT '0' NOT NULL,
	"taux_commission" numeric(5, 2),
	"actif" boolean DEFAULT true NOT NULL,
	"date_embauche" date,
	CONSTRAINT "personnel_type_contrat_check" CHECK ("personnel"."type_contrat" in ('SALARIE','JOURNALIER','PARTENAIRE'))
);
--> statement-breakpoint
ALTER TABLE "bulletins_paie" ADD CONSTRAINT "bulletins_paie_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulletins_paie" ADD CONSTRAINT "bulletins_paie_decaissement_id_bons_decaissement_id_fk" FOREIGN KEY ("decaissement_id") REFERENCES "public"."bons_decaissement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulletins_paie" ADD CONSTRAINT "bulletins_paie_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bulletin_personnel_periode" ON "bulletins_paie" USING btree ("personnel_id","periode");