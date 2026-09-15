// Primitivo de autorização reutilizável por handlers de outros contexts de domínio (regra 10:
// service/handler de um context pode chamar a API pública de outro para compor). Usado, por
// exemplo, por contexts/themes/features/active-theme/activate-theme/handler.ts.
export { authorizeActor } from "./authorize-actor";
export type { AuthorizeActorResult } from "./authorize-actor";
// Resolve o alcance efetivo de uma permission escopável pro ator corrente — para listagens
// filtrarem por id (Fase B de docs/rbac-scoped-roles.md, D3). Dormente: nenhum call site passa
// escopo ainda. A resolução das INSTÂNCIAS (nomes de categoria etc.) é composição em platform/.
// resolveScope lê o ator corrente; resolveScopeForActor recebe o id explícito (usado pelos
// service.ts de escrita do CMS na Fase C — ver docs/rbac-scoped-roles.md §4.4).
export { resolveScope, resolveScopeForActor } from "./authorize-actor";
export type { AuthorizeActorScope, ResolveScopeResult } from "./authorize-actor";

export { createCustomRoleHandler as createCustomRole } from "./features/role-management/create-custom-role/handler";
export { updateRolePermissionsHandler as updateRolePermissions } from "./features/role-management/update-role-permissions/handler";
// Concessão ADITIVA e idempotente de permissions a um papel — sem authorizeActor próprio (ver
// nota no handler). Só deve ser chamada pelo ponto de composição
// src/platform/plugin-engine/install-plugin.ts (concede ao papel "admin" as permissions do
// plugin recém-instalado). superadmin não precisa — authorize-actor.ts libera incondicional.
export { grantPermissionsToRoleHandler as grantPermissionsToRole } from "./features/role-management/grant-permissions-to-role/handler";
export { renameRoleHandler as renameRole } from "./features/role-management/rename-role/handler";
export { listRolesHandler as listRoles } from "./features/role-management/list-roles/handler";
export { assignRoleToUserHandler as assignRoleToUser } from "./features/role-assignment/assign-role-to-user/handler";
export { removeRoleFromUserHandler as removeRoleFromUser } from "./features/role-assignment/remove-role-from-user/handler";
// Escopo de recurso por atribuição de papel (Fase B de docs/rbac-scoped-roles.md). Auto-gated por
// `rbac.roles.assign`. O multi-select de instâncias (categorias por nome) que a UI de atribuição
// precisa é composição em platform/ — rbac não importa cms (D5).
export { assignScopeToRoleAssignmentHandler as assignScopeToRoleAssignment } from "./features/role-assignment/assign-scope-to-role-assignment/handler";
export { removeScopeFromRoleAssignmentHandler as removeScopeFromRoleAssignment } from "./features/role-assignment/remove-scope-from-role-assignment/handler";
// Escopos de UMA atribuição (userId × roleId) — para a tela de atribuição mostrar/editar o
// recorte por categoria. Gated por `rbac.roles.assign`.
export { listScopesForRoleAssignmentHandler as listScopesForRoleAssignment } from "./features/role-assignment/list-scopes-for-role-assignment/handler";
export { getUserContextHandler as getUserContext } from "./features/role-assignment/get-user-context/handler";
export { listUsersByRoleHandler as listUsersByRole } from "./features/role-assignment/list-users-by-role/handler";
export { countUsersWithPermissionsHandler as countUsersWithPermissions } from "./features/role-assignment/count-users-with-permissions/handler";
// Concessão automática do fluxo de registro (docs/venore-docks.md — Autenticação / Fluxo de
// registro) — sem authorizeActor de propósito, ver nota em assign-default-role/handler.ts.
export { grantDefaultRoleOnRegistrationHandler as grantDefaultRoleOnRegistration } from "./features/role-assignment/assign-default-role/handler";
// Bootstrap de superadmin (docs/venore-docks.md — Autenticação / Bootstrap de superadmin) — sem
// authorizeActor de propósito, ver nota em grant-superadmin/handler.ts.
export { checkSuperadminExistsHandler as superadminExists } from "./features/role-assignment/check-superadmin-exists/handler";
export { grantSuperadminHandler as grantSuperadmin } from "./features/role-assignment/grant-superadmin/handler";
// Self-heal idempotente do dado de bootstrap do RBAC (papéis de sistema + permissions base do
// "admin"). grant-superadmin/assign-default-role já chamam internamente; exportado pro instalador
// (scripts/install-fresh.ts) poder semear numa ordem determinística antes de registerPlugins().
export { ensureBaseRbacDataSeeded } from "./ensure-base-rbac-data";
export { approveRegistrationHandler as approveRegistration } from "./features/registration-approval/approve-registration/handler";
export { rejectRegistrationHandler as rejectRegistration } from "./features/registration-approval/reject-registration/handler";
export { listPendingRegistrationsHandler as listPendingRegistrations } from "./features/registration-approval/list-pending-registrations/handler";

export { rbacAdminNavigationItems } from "./admin-navigation";
export { rbacBreadcrumbSegments } from "./breadcrumbs";

export type { RoleRef, PermissionDefinition, UserRbacContext, ScopedPermissionMap } from "./contracts/types";
export { SYSTEM_ROLE_KEYS } from "./contracts/roles";
export type { SystemRoleKey } from "./contracts/roles";
export { RBAC_PERMISSIONS } from "./contracts/permissions";
export { RBAC_SCOPE_TYPES, isRbacScopeType } from "./contracts/scope-types";
export type { RbacScopeType } from "./contracts/scope-types";

export type { CreateCustomRoleInput, CreateCustomRoleResult } from "./features/role-management/create-custom-role/types";
export type { UpdateRolePermissionsInput, UpdateRolePermissionsResult } from "./features/role-management/update-role-permissions/types";
export type {
  GrantPermissionsToRoleInput,
  GrantPermissionsToRoleResult,
} from "./features/role-management/grant-permissions-to-role/types";
export type { RenameRoleInput, RenameRoleResult } from "./features/role-management/rename-role/types";
export type { RoleWithPermissions, ListRolesResult } from "./features/role-management/list-roles/types";
export type { AssignRoleToUserInput, AssignRoleToUserResult } from "./features/role-assignment/assign-role-to-user/types";
export type { RemoveRoleFromUserInput, RemoveRoleFromUserResult } from "./features/role-assignment/remove-role-from-user/types";
export type {
  AssignScopeToRoleAssignmentInput,
  AssignScopeToRoleAssignmentResult,
} from "./features/role-assignment/assign-scope-to-role-assignment/types";
export type {
  RemoveScopeFromRoleAssignmentInput,
  RemoveScopeFromRoleAssignmentResult,
} from "./features/role-assignment/remove-scope-from-role-assignment/types";
export type {
  ListScopesForRoleAssignmentInput,
  ListScopesForRoleAssignmentResult,
  RoleAssignmentScopeRef,
} from "./features/role-assignment/list-scopes-for-role-assignment/types";
export type { GetUserContextQuery, GetUserContextResult } from "./features/role-assignment/get-user-context/types";
export type { ListUsersByRoleInput, ListUsersByRoleResult, RoleUserRef } from "./features/role-assignment/list-users-by-role/types";
export type {
  CountUsersWithPermissionsQuery,
  CountUsersWithPermissionsResult,
} from "./features/role-assignment/count-users-with-permissions/types";
export type { GrantDefaultRoleInput, GrantDefaultRoleResult } from "./features/role-assignment/assign-default-role/types";
export type { CheckSuperadminExistsResult } from "./features/role-assignment/check-superadmin-exists/types";
export type { GrantSuperadminInput, GrantSuperadminResult } from "./features/role-assignment/grant-superadmin/types";
export type { ApproveRegistrationInput, ApproveRegistrationResult } from "./features/registration-approval/approve-registration/types";
export type { RejectRegistrationInput, RejectRegistrationResult } from "./features/registration-approval/reject-registration/types";
export type { ListPendingRegistrationsResult, PendingRegistrationView } from "./features/registration-approval/list-pending-registrations/types";
