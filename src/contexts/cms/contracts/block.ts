import { z } from "zod";

export type Area = {
  key: string;
  blocks: Block[];
};

export type Block = {
  id: string;
  key: string;
  slot: string;
  // Id de âncora DOM opcional, definido pelo admin — agnóstico a bloco (como id/key/slot), nunca
  // um editorField dentro de `data`, pra funcionar em qualquer bloco sem precisar de suporte
  // explícito. Usado por menus (main-nav/contextual) pra montar links tipo /pagina#id.
  htmlId: string | null;
  data: Record<string, unknown>;
  areas: Area[];
};

// z.lazy() com recursão exige o tipo TS anotado explicitamente (z.ZodType<Block>) antes do
// schema — senão o tsc entra em loop de inferência ou emite "implicitly has type any".
export const blockSchema: z.ZodType<Block> = z.lazy(() =>
  z.object({
    id: z.string(),
    key: z.string(),
    slot: z.string(),
    // .nullable().default(null), não .optional(): composições já persistidas (jsonb, sem
    // migration) não têm essa chave — o default garante que safeParse sempre populate `htmlId`,
    // evitando checagem de `undefined` espalhada pelo app fora deste módulo.
    htmlId: z.string().nullable().default(null),
    data: z.record(z.string(), z.unknown()),
    areas: z.array(areaSchema),
  }),
);

export const areaSchema: z.ZodType<Area> = z.lazy(() =>
  z.object({
    key: z.string(),
    blocks: z.array(blockSchema),
  }),
);

export type Composition = Block[];
export const compositionSchema: z.ZodType<Composition> = z.array(blockSchema);
