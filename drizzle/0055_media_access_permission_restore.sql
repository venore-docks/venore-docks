-- Reaplica 0054_media_access_permission, que saiu do _journal.json no merge do PR #8 (as duas
-- 0054 colidiram). Banco que já aplicou a 0054 antiga tem a coluna; banco novo não tinha.
ALTER TABLE "media"."assets" ADD COLUMN IF NOT EXISTS "access_permission" text;
