import { findUserByEmail as findUserByEmailWithCredential } from "@/contexts/auth";
import type { FindUserByEmailQuery, FoundUser as FoundUserWithCredential } from "@/contexts/auth";
import type { OperationResult } from "@/shared/types";

// Lista explícita (não `export * from "@/contexts/auth"`): o barrel do context também exporta
// primitivos de sistema SEM checagem de sessão/permissão — provisionUser/activateUser (criar e
// liberar conta), registerWithPassword, o fluxo do Auth.js (handlers/signIn/signOut) e as ações
// administrativas sobre contas de terceiros. Com `export *`, qualquer plugin ativava ou criava
// conta sem passar por gate nenhum. Aqui entra só leitura de identidade e o autoatendimento do
// próprio usuário logado; algo novo entra quando um plugin precisar, com o gate conferido.
export {
  getCurrentUser,
  getCurrentUserRegistrationStatus,
  getSessionIdentity,
  listAvailableAuthProviders,
  updateOwnAvatar,
  setOwnName,
  setOwnPassword,
  searchUsers,
  listUsers,
} from "@/contexts/auth";
export type {
  AuthenticatedUser,
  AuthProviderDescriptor,
  UserRegistrationStatus,
  GetCurrentUserResult,
  GetCurrentUserRegistrationStatusResult,
  SessionIdentity,
  GetSessionIdentityResult,
  UpdateOwnAvatarInput,
  UpdateOwnAvatarResult,
  SetOwnPasswordInput,
  SetOwnPasswordResult,
  SetOwnNameInput,
  SetOwnNameResult,
  SearchUsersQuery,
  SearchUsersResult,
  UserSummary,
  FindUserByEmailQuery,
  UserRef,
  ListUsersResult,
} from "@/contexts/auth";

// O findUserByEmail do context devolve também `passwordHash` (o login por senha precisa dele).
// Plugin nunca recebe o hash: esta versão tira o campo antes de devolver.
export type FoundUser = Omit<FoundUserWithCredential, "passwordHash">;
export type FindUserByEmailResult = OperationResult<FoundUser>;

export async function findUserByEmail(query: FindUserByEmailQuery): Promise<FindUserByEmailResult> {
  const result = await findUserByEmailWithCredential(query);
  if (!result.success) return result;
  const { id, email, name, image, avatarMediaId, status } = result.data;
  return { success: true, data: { id, email, name, image, avatarMediaId, status } };
}
