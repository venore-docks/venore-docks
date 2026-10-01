CREATE TABLE "platform"."scheduled_job_runs" (
	"key" text PRIMARY KEY NOT NULL,
	"last_started_at" timestamp with time zone,
	"last_finished_at" timestamp with time zone,
	"last_status" text,
	"last_error" text,
	"locked_until" timestamp with time zone
);
