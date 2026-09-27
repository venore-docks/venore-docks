CREATE TABLE "auth"."mfa_recovery_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "mfa_recovery_codes_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "mfa_secret" text;--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "mfa_pending_secret" text;--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "mfa_enabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "mfa_last_step" integer;--> statement-breakpoint
ALTER TABLE "auth"."mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mfa_recovery_codes_user_idx" ON "auth"."mfa_recovery_codes" USING btree ("user_id");