import { boolean, foreignKey, index, pgSchema, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "@/contexts/auth/database/schema";

export const rbacSchema = pgSchema("rbac");

export const roles = rbacSchema.table("roles", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rolePermissions = rbacSchema.table(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key").notNull(),
  },
  (rolePermission) => [
    primaryKey({ columns: [rolePermission.roleId, rolePermission.permissionKey] }),
  ],
);

export const userRoles = rbacSchema.table(
  "user_roles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (userRole) => [
    primaryKey({ columns: [userRole.userId, userRole.roleId] }),
    // A PK começa por user_id; "quem tem este papel" (listUsersByRole, invalidação de cache ao
    // mudar permissions de um papel) varria a tabela toda sem este índice.
    index("user_roles_role_id_idx").on(userRole.roleId),
  ],
);

// Fase B de docs/rbac-scoped-roles.md (D1) — tabela satélite que limita uma atribuição de papel
// (userId × roleId) a um subconjunto de instâncias de um recurso. DORMENTE até a Fase C: nenhum
// call site de authorizeActor passa `scope` ainda e nada semeia linha aqui, então o RBAC segue
// 100% global. A semântica (D2): a AUSÊNCIA de linha deste tipo para uma atribuição = alcance
// global; a presença estreita aquela atribuição aos resourceId listados.
export const roleAssignmentScopes = rbacSchema.table(
  "role_assignment_scopes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    // Namespace opaco do tipo de recurso (ex: "cms.category"). Mesma natureza de
    // role_permissions.permission_key: rbac não conhece o schema do dono do recurso.
    scopeType: text("scope_type").notNull(),
    // id da instância no domínio dono (ex: cms.categories.id). Sem FK cross-schema — mesma
    // decisão de entries.mediaId / menu_items.contentId.
    resourceId: text("resource_id").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId, t.scopeType, t.resourceId] }),
    // O escopo só existe enquanto a atribuição do papel existir: remover o papel do usuário
    // (user_roles) leva os escopos junto em cascata, de graça.
    foreignKey({
      columns: [t.userId, t.roleId],
      foreignColumns: [userRoles.userId, userRoles.roleId],
    }).onDelete("cascade"),
  ],
);
