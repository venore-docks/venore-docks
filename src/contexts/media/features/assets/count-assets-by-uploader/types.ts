import type { OperationResult } from "@/shared/types";

export type CountAssetsByUploaderQuery = { uploaderId: string };

// Só a contagem — usada por platform/identity-lifecycle/purge-user-safely.ts pra decidir se um
// hard delete de usuário é seguro.
export type CountAssetsByUploaderResult = OperationResult<number>;
