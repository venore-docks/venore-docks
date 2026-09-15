import type { OperationResult } from "@/shared/types";
import type { EntryRecord, EntryVisibility } from "../../../contracts/types";

// categoryIds/visibility/updatedSince: adicionados pro feed federado (contexts/content-feed) —
// categoryId (singular) continua existindo por compat com os chamadores atuais, os dois nunca são
// passados juntos na prática (categoryIds é AND com o resto, não substitui categoryId sozinho).
// internalOwnedOnly=false (padrão) exclui entries internas de outro context/plugin (ex: academy) —
// nunca fazia sentido essas aparecerem numa listagem "pública" de qualquer chamador externo à
// entry; só passa true quem já sabe o que está pedindo.
export type ListEntriesQuery = {
  contentTypeId?: string;
  categoryId?: string;
  categoryIds?: string[];
  visibility?: EntryVisibility;
  updatedSince?: Date;
  includeInternallyOwned?: boolean;
};
export type EntryView = EntryRecord;
export type ListEntriesResult = OperationResult<EntryView[]>;
