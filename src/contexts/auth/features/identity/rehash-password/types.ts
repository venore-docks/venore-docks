import type { OperationResult } from "@/shared/types";

export type RehashPasswordCommand = { userId: string; password: string; storedHash: string };

export type RehashPasswordResult = OperationResult<{ rehashed: boolean }>;
