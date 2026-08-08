CREATE TABLE "parrainage_clics" (
	"id" serial PRIMARY KEY NOT NULL,
	"lien_id" integer NOT NULL,
	"date_clic" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parrainage_conversions" (
	"id" serial PRIMARY KEY NOT NULL,
	"lien_id" integer NOT NULL,
	"affaire_id" integer,
	"montant" numeric(12, 2) DEFAULT '0' NOT NULL,
	"date_conversion" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parrainage_liens" (
	"id" serial PRIMARY KEY NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"code" varchar(20) NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"date_creation" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "parrainage_liens_utilisateur_id_unique" UNIQUE("utilisateur_id"),
	CONSTRAINT "parrainage_liens_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "parrainage_clics" ADD CONSTRAINT "parrainage_clics_lien_id_parrainage_liens_id_fk" FOREIGN KEY ("lien_id") REFERENCES "public"."parrainage_liens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parrainage_conversions" ADD CONSTRAINT "parrainage_conversions_lien_id_parrainage_liens_id_fk" FOREIGN KEY ("lien_id") REFERENCES "public"."parrainage_liens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parrainage_conversions" ADD CONSTRAINT "parrainage_conversions_affaire_id_affaires_id_fk" FOREIGN KEY ("affaire_id") REFERENCES "public"."affaires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parrainage_liens" ADD CONSTRAINT "parrainage_liens_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;