CREATE TABLE "speech"."worker_heartbeats" (
	"key" text PRIMARY KEY NOT NULL,
	"stage" text NOT NULL,
	"detail" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "speech"."audio_clips" ADD COLUMN "progress" integer DEFAULT 0 NOT NULL;