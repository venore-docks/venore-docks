import { getCurrentUser } from "@/contexts/auth";
import { getUserContext } from "./features/role-assignment/get-user-context/service";

export type AuthorizeActorResult =
  | { authorized: true; actorId: string }
  | { authorized: false; error: { code: string; message: string } };

// Fase B de docs/rbac-scoped-roles.md (D3). 2º argumento OPCIONAL — sem ele, o caminho é o de
// sempre, bit a bit. Nenhum call site passa `scope` nesta fase (a infra é dormente).
export type AuthorizeActorScope = { type: string; resourceId: string };

// Para FILTRAR listagens (não é sim/não, é "quais ids"): ver resolveScope abaixo.
export type ResolveScopeResult =
  | { kind: "global" }
  | { kind: "scoped"; resourceIds: string[] }
  | { kind: "none" };

// Aceita uma permission única ou uma lista — "tem qualquer uma delas" (OR), nunca "todas"
// (mesmo contrato que AdminNavItemDefinition.requiredPermission já usa pra grupos de nav, ver
// platform/admin-shell/admin-navigation.contracts.ts). Existe pra casos como publish-entry: quem
// já tem a permission ampla (cms.entries.manage) continua podendo publicar sem precisar também
// da nova, mais estreita (cms.entries.publish) — a lista é a permission estreita primeiro, a
// ampla depois, só por convenção de leitura, a ordem não importa pro resultado.
//
// `scope` (opcional, D3): quando dado, além de ter a permission o ator precisa que ela ALCANCE
// aquele recurso — `scope.type` "global" passa; lista de ids passa se `scope.resourceId` estiver
// nela; ausente nega (`rbac.authorization.forbidden_scope`). superadmin ignora escopo.
export async function authorizeActor(
  requiredPermission: string | string[],
  scope?: AuthorizeActorScope,
): Promise<AuthorizeActorResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser.success || !currentUser.data) {
    return {
      authorized: false,
      error: {
        code: "rbac.authorization.unauthenticated",
        message: "É necessário estar autenticado para executar esta operação.",
      },
    };
  }

  const context = await getUserContext({ userId: currentUser.data.id });
  if (!context.success) {
    return { authorized: false, error: context.error };
  }

  const actorId = currentUser.data.id;
  const requiredPermissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];

  if (context.data.isSuperadmin) {
    return { authorized: true, actorId };
  }

  const hasPermission = requiredPermissions.some((permission) => context.data.permissions.includes(permission));
  if (!hasPermission) {
    return {
      authorized: false,
      error: {
        code: "rbac.authorization.forbidden",
        message: `Ator não tem a permission "${requiredPermissions.join('" ou "')}".`,
      },
    };
  }

  if (!scope) {
    return { authorized: true, actorId };
  }

  const scopeSatisfied = requiredPermissions.some((permission) => {
    const value = context.data.scopedPermissions[permission]?.[scope.type];
    if (value === "global") return true;
    if (Array.isArray(value)) return value.includes(scope.resourceId);
    return false;
  });

  if (scopeSatisfied) {
    return { authorized: true, actorId };
  }

  return {
    authorized: false,
    error: {
      code: "rbac.authorization.forbidden_scope",
      message: `Ator não tem acesso ao recurso "${scope.resourceId}" para "${requiredPermissions.join('" ou "')}".`,
    },
  };
}

export type AuthorizeActorOverUserOptions = {
  // false (default) = o ator não pode aplicar a ação em si mesmo (congelar/remover/apagar a
  // própria conta trancaria o sistema se ele for o último superadmin).
  allowSelf?: boolean;
};

// Autoriza uma ação administrativa de um ator SOBRE outro usuário (congelar, remover, apagar,
// redefinir senha). Além da permission, aplica a hierarquia: só um superadmin age sobre um
// superadmin — sem isso, qualquer papel com rbac.users.manage/rbac.roles.manage tomaria a conta
// do dono da instância (redefinindo a senha dele ou congelando-o).
export async function authorizeActorOverUser(
  requiredPermission: string | string[],
  targetUserId: string,
  options: AuthorizeActorOverUserOptions = {},
): Promise<AuthorizeActorResult> {
  const authz = await authorizeActor(requiredPermission);
  if (!authz.authorized) {
    return authz;
  }

  if (!options.allowSelf && authz.actorId === targetUserId) {
    return {
      authorized: false,
      error: {
        code: "rbac.authorization.self_target",
        message: "Esta ação não pode ser aplicada à sua própria conta.",
      },
    };
  }

  const [actorContext, targetContext] = await Promise.all([
    getUserContext({ userId: authz.actorId }),
    getUserContext({ userId: targetUserId }),
  ]);
  if (!actorContext.success) {
    return { authorized: false, error: actorContext.error };
  }
  if (!targetContext.success) {
    return { authorized: false, error: targetContext.error };
  }

  if (targetContext.data.isSuperadmin && !actorContext.data.isSuperadmin) {
    return {
      authorized: false,
      error: {
        code: "rbac.authorization.target_outranks_actor",
        message: "Só um superadmin pode executar esta ação sobre outro superadmin.",
      },
    };
  }

  return authz;
}

// Resolve o alcance efetivo de UMA permission key num scopeType, para um ator DADO pelo id —
// para listagens filtrarem por id em vez de fazer um sim/não por recurso (D3), e para os
// service.ts de escrita do CMS (Fase C) que já recebem `actorId` e não podem depender de
// getCurrentUser (todo teste de integração bypassa o handler e o next-auth é stubado).
//
// - superadmin, ou algum papel concede a key sem escopo daquele tipo → { kind: "global" }.
// - a key é escopada → { kind: "scoped", resourceIds } (união dos ids permitidos).
// - o ator não tem a key de jeito nenhum → { kind: "none" }.
// - tem a key mas ela não é recortável por esse scopeType (não está em RBAC_SCOPE_TYPES) →
//   { kind: "global" }: sem recorte nesse eixo, o alcance é o da permission que ele de fato tem.
export async function resolveScopeForActor(
  actorId: string,
  permissionKey: string,
  scopeType: string,
): Promise<ResolveScopeResult> {
  const context = await getUserContext({ userId: actorId });
  if (!context.success) {
    return { kind: "none" };
  }

  if (context.data.isSuperadmin) {
    return { kind: "global" };
  }

  if (!context.data.permissions.includes(permissionKey)) {
    return { kind: "none" };
  }

  const value = context.data.scopedPermissions[permissionKey]?.[scopeType];
  if (Array.isArray(value)) {
    return { kind: "scoped", resourceIds: value };
  }
  return { kind: "global" };
}

// Mesma resolução, para o ator corrente (via getCurrentUser) — açúcar para gates de UI/loader.
export async function resolveScope(permissionKey: string, scopeType: string): Promise<ResolveScopeResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser.success || !currentUser.data) {
    return { kind: "none" };
  }

  return resolveScopeForActor(currentUser.data.id, permissionKey, scopeType);
}
