ALTER TABLE "reglements" ALTER COLUMN "affaire_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reglements" ADD COLUMN "payeur_nom" varchar(100);--> statement-breakpoint
ALTER TABLE "reglements" ADD COLUMN "payeur_prenom" varchar(100);--> statement-breakpoint
ALTER TABLE "reglements" ADD COLUMN "payeur_telephone" varchar(20);--> statement-breakpoint
ALTER TABLE "reglements" ADD COLUMN "commentaire" text;