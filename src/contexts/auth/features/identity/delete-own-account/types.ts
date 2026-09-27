import type { OperationResult } from "@/shared/types";

// confirmEmail: a pessoa digita o próprio e-mail (evita exclusão por clique acidental).
// password: obrigatória quando a conta tem senha (sessão aberta sozinha não apaga a conta).
export type DeleteOwnAccountInput = { confirmEmail: string; password?: string };
export type DeleteOwnAccountResult = OperationResult<{ id: string }>;
