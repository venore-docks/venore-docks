CREATE SCHEMA "themes";
--> statement-breakpoint
CREATE TABLE "themes"."theme_config_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text NOT NULL,
	"config" jsonb NOT NULL,
	"based_on_revision_id" uuid,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by" text,
	"published_at" timestamp with time zone,
	CONSTRAINT "theme_config_revisions_status_valid" CHECK ("themes"."theme_config_revisions"."status" IN ('draft', 'published', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "theme_config_revisions_single_draft_idx" ON "themes"."theme_config_revisions" USING btree ("status") WHERE "themes"."theme_config_revisions"."status" = 'draft';--> statement-breakpoint
CREATE UNIQUE INDEX "theme_config_revisions_single_published_idx" ON "themes"."theme_config_revisions" USING btree ("status") WHERE "themes"."theme_config_revisions"."status" = 'published';--> statement-breakpoint
CREATE INDEX "theme_config_revisions_archived_published_at_idx" ON "themes"."theme_config_revisions" USING btree ("published_at" DESC NULLS LAST) WHERE "themes"."theme_config_revisions"."status" = 'archived';