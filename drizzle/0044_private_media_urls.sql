-- Assets não públicos passam a ser servidos pela rota autorizada do app (/api/media/asset/[id])
-- em vez da URL crua do storage (contexts/media/asset-url.ts). Assets públicos não mudam.
UPDATE "media"."assets" SET "url" = '/api/media/asset/' || "id" WHERE "visibility" <> 'public';
