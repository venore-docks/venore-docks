-- Guardado à mão: se já existirem contas com o mesmo e-mail em maiúsculas/minúsculas diferentes,
-- o índice único não é criado (o deploy não quebra) e o Postgres registra um WARNING. Resolver
-- as duplicatas e rodar o CREATE UNIQUE INDEX abaixo manualmente.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "auth"."users" GROUP BY lower("email") HAVING count(*) > 1) THEN
    RAISE WARNING 'auth.users tem e-mails duplicados sem diferenciar maiúsculas — users_email_lower_idx NÃO foi criado.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS "users_email_lower_idx" ON "auth"."users" USING btree (lower("email"));
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX "entries_category_status_published_at_idx" ON "cms"."entries" USING btree ("category_id","status","published_at");--> statement-breakpoint
CREATE INDEX "entries_scheduled_publish_at_idx" ON "cms"."entries" USING btree ("scheduled_publish_at") WHERE "cms"."entries"."status" = 'scheduled';--> statement-breakpoint
CREATE INDEX "entries_scheduled_archive_at_idx" ON "cms"."entries" USING btree ("scheduled_archive_at") WHERE "cms"."entries"."scheduled_archive_at" is not null;--> statement-breakpoint
CREATE INDEX "entries_author_id_idx" ON "cms"."entries" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_id_idx" ON "rbac"."user_roles" USING btree ("role_id");