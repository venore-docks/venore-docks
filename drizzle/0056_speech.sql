CREATE SCHEMA "speech";
--> statement-breakpoint
CREATE TABLE "speech"."audio_clips" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"item_key" text NOT NULL,
	"locale" text NOT NULL,
	"text" text NOT NULL,
	"voice" text NOT NULL,
	"text_hash" text NOT NULL,
	"characters" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"media_asset_id" text,
	"synthesized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speech"."sync_cursors" (
	"key" text PRIMARY KEY NOT NULL,
	"cursor" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speech"."usage_months" (
	"month" text PRIMARY KEY NOT NULL,
	"characters" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "audio_clips_item_idx" ON "speech"."audio_clips" USING btree ("scope","item_key","locale");--> statement-breakpoint
CREATE INDEX "audio_clips_status_idx" ON "speech"."audio_clips" USING btree ("status");