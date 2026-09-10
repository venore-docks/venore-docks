CREATE SCHEMA "content_feed";
--> statement-breakpoint
CREATE TABLE "content_feed"."articles" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"remote_ref" text NOT NULL,
	"title" text NOT NULL,
	"excerpt_text" text,
	"cover_image_url" text,
	"category_key" text NOT NULL,
	"entry_slug" text NOT NULL,
	"category_slug" text,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_feed"."connection_categories" (
	"connection_id" text NOT NULL,
	"category_id" text NOT NULL,
	CONSTRAINT "connection_categories_connection_id_category_id_pk" PRIMARY KEY("connection_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "content_feed"."connections" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "content_feed"."source_categories" (
	"source_id" text NOT NULL,
	"category_key" text NOT NULL,
	CONSTRAINT "source_categories_source_id_category_key_pk" PRIMARY KEY("source_id","category_key")
);
--> statement-breakpoint
CREATE TABLE "content_feed"."sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"remote_url" text NOT NULL,
	"connection_key" text NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_feed"."articles" ADD CONSTRAINT "articles_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "content_feed"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_feed"."connection_categories" ADD CONSTRAINT "connection_categories_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "content_feed"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_feed"."connection_categories" ADD CONSTRAINT "connection_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "cms"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_feed"."source_categories" ADD CONSTRAINT "source_categories_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "content_feed"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_feed_articles_source_remote_ref_idx" ON "content_feed"."articles" USING btree ("source_id","remote_ref");