CREATE SCHEMA "platform";
--> statement-breakpoint
CREATE TABLE "platform"."rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."users" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
CREATE INDEX "rate_limits_expires_at_idx" ON "platform"."rate_limits" USING btree ("expires_at");