ALTER TABLE "utilisateurs" ADD COLUMN "tentatives_echouees" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "utilisateurs" ADD COLUMN "bloque_jusqua" timestamp;