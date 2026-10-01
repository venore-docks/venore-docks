import { listUsers } from "@/contexts/auth";
import { listRoles, listScopesForRoleAssignment, listUsersByRole } from "@/contexts/rbac";
import { registerPlugins } from "@/platform/plugin-engine/register-plugins";
import { getRbacPageData } from "@/platform/admin-shell/get-rbac-page-data";
import { getRbacScopeOptions } from "@/platform/admin-shell/get-rbac-scope-options";
import { CreateRoleForm } from "./_components/create-role-form";
import { RoleMatrix, type RoleMatrixRole, type ScopesByAssignment } from "./_components/role-matrix";
import { buildPermissionGroups } from "./_components/permission-catalog";

export default async function RbacAdminPage() {
  const gate = await getRbacPageData();

  if (!gate.granted) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para gerenciar papéis e permissões.</p>
      </div>
    );
  }

  const [rolesResult, usersResult, pluginReport, scopeOptions] = await Promise.all([
    listRoles(),
    listUsers(),
    registerPlugins(),
    getRbacScopeOptions(),
  ]);

  if (!rolesResult.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar os papéis agora. Tente recarregar a página.</p>;
  }
  if (!usersResult.success) {
    return <p className="text-sm text-destructive">Não foi possível carregar os usuários agora. Tente recarregar a página.</p>;
  }

  const roles = rolesResult.data;
  const allUsers = usersResult.data;
  const groups = buildPermissionGroups(pluginReport.permissions, pluginReport.entries);

  const usersByRole = await Promise.all(
    roles.map(async (role) => {
      const result = await listUsersByRole({ roleId: role.id });
      return { roleId: role.id, users: result.success ? result.data : [] };
    }),
  );
  const usersByRoleId = new Map(usersByRole.map((entry) => [entry.roleId, entry.users]));

  // Fase C: escopos por atribuição (userId × roleId), só para papéis que concedem alguma
  // permission recortável por "cms.category". roleId → userId → ids de categoria.
  const scopableRoleIds = new Set(
    roles
      .filter((role) => role.key !== "superadmin" && role.permissionKeys.some((key) => scopeOptions.scopablePermissionKeys.includes(key)))
      .map((role) => role.id),
  );
  const scopesByAssignment: ScopesByAssignment = {};
  await Promise.all(
    [...scopableRoleIds].map(async (roleId) => {
      const roleUsers = usersByRoleId.get(roleId) ?? [];
      const perUser: Record<string, string[]> = {};
      await Promise.all(
        roleUsers.map(async (user) => {
          const result = await listScopesForRoleAssignment({ userId: user.id, roleId });
          perUser[user.id] = result.success
            ? result.data.filter((scope) => scope.scopeType === "cms.category").map((scope) => scope.resourceId)
            : [];
        }),
      );
      scopesByAssignment[roleId] = perUser;
    }),
  );

  const matrixRoles: RoleMatrixRole[] = roles.map((role) => {
    const roleUsers = usersByRoleId.get(role.id) ?? [];
    return {
      id: role.id,
      key: role.key,
      name: role.name,
      isSystem: role.isSystem,
      isSuperadmin: role.key === "superadmin",
      permissionKeys: role.permissionKeys,
      users: roleUsers,
      assignableUsers: allUsers.filter((user) => !roleUsers.some((roleUser) => roleUser.id === user.id)),
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Papéis e permissões</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina o que cada papel pode fazer na organização e quem tem cada papel.
        </p>
      </div>

      <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
        <h2 className="text-sm font-semibold text-foreground">Criar papel personalizado</h2>
        <CreateRoleForm groups={groups} />
      </section>

      <section>
        <RoleMatrix
          roles={matrixRoles}
          groups={groups}
          categories={scopeOptions.categories}
          scopablePermissionKeys={scopeOptions.scopablePermissionKeys}
          scopesByAssignment={scopesByAssignment}
          canManageSuperadmin={gate.actor.isSuperadmin}
        />
      </section>
    </div>
  );
}
