import type { OperationResult } from "@/shared/types";
import type { UserRegistrationStatus } from "../../../contracts/types";

export type FindUserByEmailQuery = {
  email: string;
};

// Registro de identidade + credencial, lido direto do banco — não é uma sessão (por isso não
// reaproveita AuthenticatedUser: authProvider ali é "provider desta sessão", sem sentido pra uma
// busca por email). Inclui `passwordHash` e `status`, que o provider Credentials
// (contexts/auth/providers.ts) precisa pra autenticar e pra barrar usuário pending. Reexportado
// pelo barrel — consumidores administrativos (ex: academy enrollStudentAction, o script de
// bootstrap) só devem ler os campos de identidade e nunca repassar `passwordHash` adiante.
export type FoundUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  avatarMediaId: string | null;
  passwordHash: string | null;
  status: UserRegistrationStatus;
};

export type FindUserByEmailResult = OperationResult<FoundUser>;
