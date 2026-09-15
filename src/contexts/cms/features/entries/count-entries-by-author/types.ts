import type { OperationResult } from "@/shared/types";

export type CountEntriesByAuthorQuery = { authorId: string };

// Só a contagem — usada por platform/identity-lifecycle/purge-user-safely.ts pra decidir se um
// hard delete de usuário é seguro, nunca pra listar quais entries são (isso é list-entries-for-admin).
export type CountEntriesByAuthorResult = OperationResult<number>;
