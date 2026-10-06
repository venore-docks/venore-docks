CREATE TABLE "speech"."scope_sources" (
	"scope" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"href" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
