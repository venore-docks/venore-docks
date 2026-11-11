// Leitura pública: filtros por tipo da listagem de categoria, sem authorizeActor
// (docs/venore-docks.md — CMS). A visibilidade do visitante é decidida por quem chama.
import { countCategoryEntriesByType } from "./service";
import type { CountCategoryEntriesByTypeQuery, CountCategoryEntriesByTypeResult } from "./types";

export async function countCategoryEntriesByTypeHandler(query: CountCategoryEntriesByTypeQuery): Promise<CountCategoryEntriesByTypeResult> {
  return countCategoryEntriesByType(query);
}
