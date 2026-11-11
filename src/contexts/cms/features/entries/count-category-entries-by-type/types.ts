import type { OperationResult } from "@/shared/types";
import type { EntryVisibility } from "../../../contracts/types";

export type CountCategoryEntriesByTypeQuery = {
  categoryId: string;
  // Visitante sem sessão só conta o que é "public" (C7) — mesmo critério da listagem.
  visibility?: EntryVisibility;
};

export type CategoryTypeCount = { contentTypeId: string; key: string; name: string; count: number };

export type CountCategoryEntriesByTypeResult = OperationResult<CategoryTypeCount[]>;
