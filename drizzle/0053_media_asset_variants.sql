CREATE TABLE "media"."asset_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_id" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"pathname" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media"."assets" ADD COLUMN "variants_processed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media"."asset_variants" ADD CONSTRAINT "asset_variants_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "media"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_asset_variants_pathname_idx" ON "media"."asset_variants" USING btree ("pathname");--> statement-breakpoint
CREATE UNIQUE INDEX "media_asset_variants_asset_width_idx" ON "media"."asset_variants" USING btree ("asset_id","width");