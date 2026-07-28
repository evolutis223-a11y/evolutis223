CREATE TABLE "branches" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"nom" varchar(60) NOT NULL,
	CONSTRAINT "branches_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "branche_id" integer;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_branche_id_branches_id_fk" FOREIGN KEY ("branche_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;