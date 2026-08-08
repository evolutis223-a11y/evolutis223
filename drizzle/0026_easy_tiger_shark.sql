CREATE TABLE "charges_fixes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" varchar(100) NOT NULL,
	"montant_estime" numeric(12, 2) DEFAULT '0' NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"cree_par" integer,
	"date_creation" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "objectifs_ca" (
	"id" serial PRIMARY KEY NOT NULL,
	"periode" varchar(10) NOT NULL,
	"montant" numeric(12, 2) DEFAULT '0' NOT NULL,
	"modifie_par" integer,
	"date_modification" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "objectifs_ca_periode_unique" UNIQUE("periode"),
	CONSTRAINT "objectifs_ca_periode_check" CHECK ("objectifs_ca"."periode" in ('JOUR','SEMAINE','MOIS'))
);
--> statement-breakpoint
CREATE TABLE "prets" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(20) NOT NULL,
	"preteur_nom" varchar(150) NOT NULL,
	"montant" numeric(12, 2) NOT NULL,
	"date_obtention" date NOT NULL,
	"date_echeance" date,
	"statut" varchar(20) DEFAULT 'EN_COURS' NOT NULL,
	"cree_par" integer,
	"date_creation" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prets_type_check" CHECK ("prets"."type" in ('BANCAIRE','PERSONNEL','PROPRIETAIRE')),
	CONSTRAINT "prets_statut_check" CHECK ("prets"."statut" in ('EN_COURS','REMBOURSE'))
);
--> statement-breakpoint
CREATE TABLE "prets_remboursements" (
	"id" serial PRIMARY KEY NOT NULL,
	"pret_id" integer NOT NULL,
	"montant" numeric(12, 2) NOT NULL,
	"auteur_id" integer,
	"date_remboursement" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bons_decaissement" ADD COLUMN "charge_fixe_id" integer;--> statement-breakpoint
ALTER TABLE "charges_fixes" ADD CONSTRAINT "charges_fixes_cree_par_utilisateurs_id_fk" FOREIGN KEY ("cree_par") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectifs_ca" ADD CONSTRAINT "objectifs_ca_modifie_par_utilisateurs_id_fk" FOREIGN KEY ("modifie_par") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prets" ADD CONSTRAINT "prets_cree_par_utilisateurs_id_fk" FOREIGN KEY ("cree_par") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prets_remboursements" ADD CONSTRAINT "prets_remboursements_pret_id_prets_id_fk" FOREIGN KEY ("pret_id") REFERENCES "public"."prets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prets_remboursements" ADD CONSTRAINT "prets_remboursements_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bons_decaissement" ADD CONSTRAINT "bons_decaissement_charge_fixe_id_charges_fixes_id_fk" FOREIGN KEY ("charge_fixe_id") REFERENCES "public"."charges_fixes"("id") ON DELETE no action ON UPDATE no action;