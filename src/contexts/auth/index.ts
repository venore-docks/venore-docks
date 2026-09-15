export { handlers, signIn, signOut } from "./auth.config";
export { getCurrentUserHandler as getCurrentUser } from "./features/session/get-current-user/handler";
export { getCurrentUserRegistrationStatusHandler as getCurrentUserRegistrationStatus } from "./features/session/get-current-user-registration-status/handler";
export { listAvailableAuthProviders } from "./providers";
export type { AuthenticatedUser, AuthProviderDescriptor, UserRegistrationStatus } from "./contracts/types";
export type { GetCurrentUserResult } from "./features/session/get-current-user/types";
export type { GetCurrentUserRegistrationStatusResult } from "./features/session/get-current-user-registration-status/types";

// Marca um usuário recém-criado como pending. Usado pelo ponto de composição do fluxo de
// registro (src/platform/registration/handle-user-registered.ts, docs/venore-docks.md — regra 12).
export { provisionUserHandler as provisionUser } from "./features/identity/provision-user/handler";
export type { ProvisionUserCommand, ProvisionUserResult } from "./features/identity/provision-user/types";

// Self-service: atualiza o avatarMediaId do próprio usuário logado — actorId resolvido da sessão
// dentro do handler, sem RBAC (não há "permission" pra editar o próprio perfil).
export { updateOwnAvatarHandler as updateOwnAvatar } from "./features/identity/update-own-avatar/handler";
export type { UpdateOwnAvatarInput, UpdateOwnAvatarResult } from "./features/identity/update-own-avatar/types";

// Credencial de senha (provider Credentials). set-own-password é self-service (actorId da sessão,
// sem RBAC); admin-set-user-password é gated por rbac.roles.manage no próprio handler. Ambos
// gravam auth.users.password_hash no formato scrypt$<salt>$<hash> que o login lê.
export { setOwnPasswordHandler as setOwnPassword } from "./features/identity/set-own-password/handler";
export type { SetOwnPasswordInput, SetOwnPasswordResult } from "./features/identity/set-own-password/types";
export { adminSetUserPasswordHandler as adminSetUserPassword } from "./features/identity/admin-set-user-password/handler";
export type {
  AdminSetUserPasswordInput,
  AdminSetUserPasswordResult,
} from "./features/identity/admin-set-user-password/types";

// Ciclo de vida de conta já aprovada — congelar bloqueia login (o mesmo choque P9 do status
// "pending", ver get-current-user/service.ts) sem precisar revogar sessão à parte (estratégia é
// JWT, status é revalidado no banco a cada request). Gated por rbac.users.manage no próprio handler
// (mesmo padrão de adminSetUserPassword).
export { freezeUserHandler as freezeUser } from "./features/identity/freeze-user/handler";
export type { FreezeUserInput, FreezeUserResult } from "./features/identity/freeze-user/types";
export { unfreezeUserHandler as unfreezeUser } from "./features/identity/unfreeze-user/handler";
export type { UnfreezeUserInput, UnfreezeUserResult } from "./features/identity/unfreeze-user/types";

// Remoção é soft-delete/anonimização, nunca DELETE físico — cms.entries.authorId e
// media.assets.uploadedBy referenciam auth.users.id sem onDelete. Gated por rbac.users.remove
// (mais restrita que rbac.users.manage, mesmo padrão de media.purge vs media.manage).
export { removeUserHandler as removeUser } from "./features/identity/remove-user/handler";
export type { RemoveUserInput, RemoveUserResult } from "./features/identity/remove-user/types";

// Hard delete real — só age sobre conta já "removed". Fora do barrel usado direto por Server
// Action: quem chama é platform/identity-lifecycle/purge-user-safely.ts, que reconfirma ausência
// de conteúdo (cms/media) antes. Gated por rbac.users.purge no próprio handler (superadmin only).
export { purgeUserHandler as purgeUser } from "./features/identity/purge-user/handler";
export type { PurgeUserInput, PurgeUserResult } from "./features/identity/purge-user/types";

// Criação de conta pelo admin — nasce "approved" (default do schema), diferente do autorregistro
// que rebaixa pra "pending" via provisionUser. Gated por rbac.users.manage.
export { adminCreateUserHandler as adminCreateUser } from "./features/identity/admin-create-user/handler";
export type { AdminCreateUserInput, AdminCreateUserResult, CreatedUser } from "./features/identity/admin-create-user/types";

// Diretório de usuários com busca/filtro/paginação, para a tela /admin/community — sem
// verificação de autorização própria, mesmo racional de listUsers (regra 10): quem autoriza é o
// loader de página, já gated por rbac.users.manage.
export { searchUsersHandler as searchUsers } from "./features/identity/search-users/handler";
export type { SearchUsersQuery, SearchUsersResult, UserSummary } from "./features/identity/search-users/types";

// Lookup por email, sem verificação de autorização própria — destinado a ferramentas
// administrativas/scripts (ex: scripts/bootstrap-superadmin.mjs), não para uso geral por
// plugin/tema (docs/venore-docks.md — regra 14: expõe usuário por email sem checagem de ator).
export { findUserByEmailHandler as findUserByEmail } from "./features/identity/find-user-by-email/handler";
export type { FindUserByEmailQuery, FindUserByEmailResult, FoundUser } from "./features/identity/find-user-by-email/types";

// Diretório geral de usuários — sem verificação de autorização própria, mesmo raciocínio de
// listPendingUsers (regra 10): quem autoriza é quem compõe (rbac/list-users-by-role, ou o
// loader de página de app/admin/rbac, já gated por rbac.roles.manage antes de chegar aqui).
export { listUsersHandler as listUsers } from "./features/identity/list-users/handler";
export type { UserRef, ListUsersResult } from "./features/identity/list-users/types";

// Registro por senha (provider Credentials): cria auth.users com senha pra um visitante anônimo.
// O ponto de composição (src/platform/registration/handle-user-registered.ts) decide superadmin
// inicial vs. pending logo depois — mesmo fluxo do evento createUser do Auth.js pro OAuth.
export { registerWithPasswordHandler as registerWithPassword } from "./features/registration/register-with-password/handler";
export type {
  RegisterWithPasswordInput,
  RegisterWithPasswordResult,
  RegisteredUser,
} from "./features/registration/register-with-password/types";

// Primitivos do fluxo de registro (docs/venore-docks.md — Autenticação / Fluxo de registro).
// Sem verificação de autorização própria — quem autoriza é o handler de rbac que compõe com
// eles (contexts/rbac/features/registration-approval/*), via este barrel (regra 10).
export { listPendingUsersHandler as listPendingUsers } from "./features/registration/list-pending-users/handler";
export { approveUserRegistrationHandler as approveUserRegistration } from "./features/registration/approve-user-registration/handler";
export { rejectUserRegistrationHandler as rejectUserRegistration } from "./features/registration/reject-user-registration/handler";
export type { PendingUserRef, ListPendingUsersResult } from "./features/registration/list-pending-users/types";
export type { ApproveUserRegistrationInput, ApproveUserRegistrationResult } from "./features/registration/approve-user-registration/types";
export type { RejectUserRegistrationInput, RejectUserRegistrationResult } from "./features/registration/reject-user-registration/types";
