import type { OperationResult } from "@/shared/types";

// currentPassword: obrigatório quando a conta já tem senha — sem ele, quem pegasse uma sessão
// aberta trocava a senha e tomava a conta. Conta só-OAuth (sem senha) define a primeira sem ele.
export type SetOwnPasswordCommand = { actorId: string; newPassword: string; currentPassword?: string };
export type SetOwnPasswordInput = Omit<SetOwnPasswordCommand, "actorId">;
export type SetOwnPasswordResult = OperationResult<{ id: string }>;
