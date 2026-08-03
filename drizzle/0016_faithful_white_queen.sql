ALTER TABLE "affaires" ADD COLUMN "provenance" varchar(30);--> statement-breakpoint
ALTER TABLE "affaires" ADD COLUMN "objet" varchar(200);--> statement-breakpoint
ALTER TABLE "affaires" ADD COLUMN "tva_pct" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "affaires" ADD COLUMN "remise_montant" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "affaires" ADD COLUMN "remise_unite" varchar(4);--> statement-breakpoint
ALTER TABLE "affaires" ADD COLUMN "infos_complementaires" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "email" varchar(150);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "adresse" varchar(250);--> statement-breakpoint
ALTER TABLE "affaires" ADD CONSTRAINT "affaires_remise_unite_check" CHECK ("affaires"."remise_unite" is null or "affaires"."remise_unite" in ('%','F'));--> statement-breakpoint
ALTER TABLE "affaires" ADD CONSTRAINT "affaires_provenance_check" CHECK ("affaires"."provenance" is null or "affaires"."provenance" in ('Boutique physique','Boutique en ligne','WhatsApp','TikTok','Facebook'));