CREATE TABLE "fournisseurs" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" varchar(150) NOT NULL,
	"contact" varchar(150),
	"delai_livraison_jours" integer,
	"actif" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "fournisseur_id" integer;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_fournisseur_id_fournisseurs_id_fk" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."fournisseurs"("id") ON DELETE no action ON UPDATE no action;