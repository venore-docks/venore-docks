CREATE TABLE "cms"."entry_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"category_id" text,
	"visibility" text NOT NULL,
	"media_id" text,
	"content_type_ids" jsonb,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "entry_revisions_kind_valid" CHECK ("cms"."entry_revisions"."kind" IN ('snapshot', 'proposal')),
	CONSTRAINT "entry_revisions_status_valid" CHECK ("cms"."entry_revisions"."status" IS NULL OR "cms"."entry_revisions"."status" IN ('pending', 'applied', 'discarded'))
);
--> statement-breakpoint
ALTER TABLE "cms"."entry_revisions" ADD CONSTRAINT "entry_revisions_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "cms"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms"."entry_revisions" ADD CONSTRAINT "entry_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms"."entry_revisions" ADD CONSTRAINT "entry_revisions_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entry_revisions_entry_created_idx" ON "cms"."entry_revisions" USING btree ("entry_id","created_at");