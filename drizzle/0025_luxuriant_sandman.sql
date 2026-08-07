CREATE TABLE "paiements_mobile_money" (
	"id" serial PRIMARY KEY NOT NULL,
	"affaire_id" integer,
	"reference" varchar(80) NOT NULL,
	"montant" numeric(12, 2) NOT NULL,
	"telephone" varchar(20) NOT NULL,
	"statut" varchar(20) DEFAULT 'EN_ATTENTE' NOT NULL,
	"reglement_id" integer,
	"brut" jsonb,
	"date_creation" timestamp DEFAULT now() NOT NULL,
	"date_confirmation" timestamp,
	CONSTRAINT "paiements_mobile_money_reference_unique" UNIQUE("reference"),
	CONSTRAINT "paiements_mobile_money_statut_check" CHECK ("paiements_mobile_money"."statut" in ('EN_ATTENTE','REUSSI','ECHOUE'))
);
--> statement-breakpoint
ALTER TABLE "reglements" ALTER COLUMN "auteur_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "paiements_mobile_money" ADD CONSTRAINT "paiements_mobile_money_affaire_id_affaires_id_fk" FOREIGN KEY ("affaire_id") REFERENCES "public"."affaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paiements_mobile_money" ADD CONSTRAINT "paiements_mobile_money_reglement_id_reglements_id_fk" FOREIGN KEY ("reglement_id") REFERENCES "public"."reglements"("id") ON DELETE no action ON UPDATE no action;