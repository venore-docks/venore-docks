-- Busca pública do CMS (features/entries/search-published-entries). Coluna gerada fora do schema
-- Drizzle de propósito (ver comentário em contexts/cms/database/schema). Só os valores de texto do
-- `data`; cada texto entra original (stemmer português) e sem acento; título com peso A.
ALTER TABLE "cms"."entries" ADD COLUMN IF NOT EXISTS "search_vector" tsvector GENERATED ALWAYS AS (
  setweight(
    to_tsvector('portuguese'::regconfig, lower("title"))
    || to_tsvector('portuguese'::regconfig, translate(lower("title"), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')),
    'A'
  )
  || setweight(
    to_tsvector('portuguese'::regconfig, lower(jsonb_path_query_array("data", 'strict $.** ? (@.type() == "string")')::text))
    || to_tsvector('portuguese'::regconfig, translate(lower(jsonb_path_query_array("data", 'strict $.** ? (@.type() == "string")')::text), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')),
    'B'
  )
) STORED;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entries_search_vector_idx" ON "cms"."entries" USING gin ("search_vector");
