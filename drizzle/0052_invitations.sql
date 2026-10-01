CREATE TABLE "auth"."invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role_id" text NOT NULL,
	"invited_by" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "auth"."invitations" USING btree ("email");