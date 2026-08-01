CREATE TABLE "finitions_configurateur" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" varchar(150) NOT NULL,
	"montant" numeric(12, 2) NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"ordre" integer DEFAULT 99 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modeles_configurateur" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" varchar(150) NOT NULL,
	"article_id" integer NOT NULL,
	"photo_url" text NOT NULL,
	"prix_depart" numeric(12, 2) NOT NULL,
	"zones" jsonb NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"ordre" integer DEFAULT 99 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "modeles_configurateur" ADD CONSTRAINT "modeles_configurateur_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;