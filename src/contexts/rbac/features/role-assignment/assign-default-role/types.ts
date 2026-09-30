import type { OperationResult } from "@/shared/types";

export type GrantDefaultRoleInput = {
  userId: string;
  // Papel padrão escolhido pelo admin (setting auth.registration_default_role, lida em
  // platform/registration — rbac não pode depender de settings, regra 12). Ausente = env
  // RBAC_DEFAULT_REGISTRATION_ROLE_KEY ou "member".
  roleKey?: string;
};

export type GrantDefaultRoleResult = OperationResult<void>;
