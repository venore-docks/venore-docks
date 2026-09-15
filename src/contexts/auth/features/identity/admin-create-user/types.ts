import type { OperationResult } from "@/shared/types";

export type AdminCreateUserCommand = { actorId: string; email: string; name: string; password: string };
export type AdminCreateUserInput = Omit<AdminCreateUserCommand, "actorId">;
export type CreatedUser = { id: string; email: string; name: string | null };
export type AdminCreateUserResult = OperationResult<CreatedUser>;
