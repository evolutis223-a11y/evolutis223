ALTER TABLE "reglements" DROP CONSTRAINT "reglements_mode_check";--> statement-breakpoint
ALTER TABLE "reglements" ADD COLUMN "reference" varchar(60);--> statement-breakpoint
ALTER TABLE "reglements" ADD CONSTRAINT "reglements_mode_check" CHECK ("reglements"."mode" in ('ESPECES','MOBILE_MONEY','VIREMENT','CHEQUE'));