ALTER TABLE "ordres_fabrication" DROP CONSTRAINT "ordres_fabrication_etape_check";--> statement-breakpoint
ALTER TABLE "ordres_fabrication" ALTER COLUMN "etape" SET DEFAULT 'RECEPTION';--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "necessite_assemblage" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lignes_affaire" ADD COLUMN "personnalise" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ordres_fabrication" ADD COLUMN "personnalise" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ordres_fabrication" ADD CONSTRAINT "ordres_fabrication_etape_check" CHECK ("ordres_fabrication"."etape" in ('RECEPTION','CONCEPTION','PRODUCTION','CONTROLE_QUALITE','PRET'));