ALTER TABLE "livraisons" ADD COLUMN "cout_livraison" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "livraisons" ADD COLUMN "cout_livraison_paye" boolean DEFAULT false NOT NULL;