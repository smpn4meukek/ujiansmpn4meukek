CREATE TABLE "records" (
	"store" text,
	"id" text,
	"data" jsonb,
	"deleted" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "records_pkey" PRIMARY KEY("store","id")
);
--> statement-breakpoint
CREATE INDEX "records_updated_at_idx" ON "records" ("updated_at");