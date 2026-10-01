import type { OperationResult } from "@/shared/types";
import type { EntryRecord } from "../../../contracts/types";

// includeAuthenticated: o chamador (página /busca) resolve se o visitante está logado — conteúdo
// "authenticated" só entra pra quem tem sessão (C7).
export type SearchPublishedEntriesQuery = { query: string; includeAuthenticated: boolean; limit: number; offset: number };
export type SearchPublishedEntriesResult = OperationResult<{ entries: EntryRecord[]; hasMore: boolean }>;
