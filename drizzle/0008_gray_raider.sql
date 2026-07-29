CREATE TABLE "parametres_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"type_document" varchar(30) NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"modifie_par" integer,
	"date_modification" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "parametres_documents_type_document_unique" UNIQUE("type_document")
);
--> statement-breakpoint
ALTER TABLE "parametres_documents" ADD CONSTRAINT "parametres_documents_modifie_par_utilisateurs_id_fk" FOREIGN KEY ("modifie_par") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;