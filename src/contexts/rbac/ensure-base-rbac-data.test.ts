import { beforeEach, describe, expect, it, vi } from "vitest";

type RoleValues = { key: string; name: string; isSystem: boolean };
type RolePermissionValues = { roleId: string; permissionKey: string };

const selectLimit = vi.fn<() => Promise<Array<{ id: string }>>>();
const selectWhere = vi.fn(() => ({ limit: selectLimit }));
const selectFrom = vi.fn(() => ({ where: selectWhere }));
const txSelect = vi.fn(() => ({ from: selectFrom }));

const insertOnConflict = vi.fn<(config: unknown) => Promise<void>>();
const insertValues = vi.fn<(values: RoleValues[] | RolePermissionValues[]) => { onConflictDoNothing: typeof insertOnConflict }>(() => ({
  onConflictDoNothing: insertOnConflict,
}));
const txInsert = vi.fn(() => ({ values: insertValues }));

type Tx = { select: typeof txSelect; insert: typeof txInsert };
const tx: Tx = { select: txSelect, insert: txInsert };
const transactionMock = vi.fn(async (callback: (tx: Tx) => Promise<void>) => callback(tx));

vi.mock("@/infrastructure/database/client", () => ({
  db: { transaction: transactionMock },
}));

describe("ensureBaseRbacDataSeeded", () => {
  beforeEach(() => {
    transactionMock.mockClear();
    txSelect.mockClear();
    selectFrom.mockClear();
    selectWhere.mockClear();
    selectLimit.mockReset().mockResolvedValue([]);
    txInsert.mockClear();
    insertValues.mockClear();
    insertOnConflict.mockReset().mockResolvedValue(undefined);
  });

  it("upserts the 5 system roles idempotently with canonical aliases, ON CONFLICT DO NOTHING by key", async () => {
    const { ensureBaseRbacDataSeeded } = await import("./ensure-base-rbac-data");
    await ensureBaseRbacDataSeeded();

    const rolesValuesArg = insertValues.mock.calls[0][0];
    expect(rolesValuesArg).toEqual([
      { key: "superadmin", name: "Overlord", isSystem: true },
      { key: "admin", name: "Administrador", isSystem: true },
      { key: "member", name: "Membro", isSystem: true },
      { key: "editor", name: "Editor", isSystem: true },
      { key: "author", name: "Autor", isSystem: true },
    ]);
    expect(insertOnConflict).toHaveBeenCalled();
  });

  it("grants admin / editor / author their base permission lists once each role id is resolved", async () => {
    selectLimit
      .mockResolvedValueOnce([{ id: "admin-role-id" }])
      .mockResolvedValueOnce([{ id: "editor-role-id" }])
      .mockResolvedValueOnce([{ id: "author-role-id" }]);

    const { ensureBaseRbacDataSeeded } = await import("./ensure-base-rbac-data");
    await ensureBaseRbacDataSeeded();

    const adminPerms = insertValues.mock.calls[1][0] as RolePermissionValues[];
    expect(adminPerms).toHaveLength(16);
    expect(adminPerms.every((row) => row.roleId === "admin-role-id")).toBe(true);
    expect(adminPerms.map((row) => row.permissionKey)).toContain("platform.admin.access");
    expect(adminPerms.map((row) => row.permissionKey)).toContain("rbac.users.manage");
    expect(adminPerms.map((row) => row.permissionKey)).not.toContain("media.purge");
    expect(adminPerms.map((row) => row.permissionKey)).not.toContain("rbac.users.remove");

    const editorPerms = insertValues.mock.calls[2][0] as RolePermissionValues[];
    expect(editorPerms.every((row) => row.roleId === "editor-role-id")).toBe(true);
    expect(editorPerms.map((row) => row.permissionKey)).toEqual([
      "platform.admin.access",
      "cms.categories.manage",
      "cms.entries.manage",
      "cms.entries.publish",
    ]);

    const authorPerms = insertValues.mock.calls[3][0] as RolePermissionValues[];
    expect(authorPerms.every((row) => row.roleId === "author-role-id")).toBe(true);
    expect(authorPerms.map((row) => row.permissionKey)).toEqual([
      "platform.admin.access",
      "cms.entries.manage",
    ]);
    // Autor não publica e não gerencia categorias — é o que o separa do Editor (D6).
    expect(authorPerms.map((row) => row.permissionKey)).not.toContain("cms.entries.publish");
    expect(authorPerms.map((row) => row.permissionKey)).not.toContain("cms.categories.manage");
  });

  it("skips a system role's permissions when its id can't be resolved, without aborting the others", async () => {
    selectLimit
      .mockResolvedValueOnce([]) // admin não resolve
      .mockResolvedValueOnce([{ id: "editor-role-id" }])
      .mockResolvedValueOnce([{ id: "author-role-id" }]);

    const { ensureBaseRbacDataSeeded } = await import("./ensure-base-rbac-data");
    await ensureBaseRbacDataSeeded();

    // roles insert + editor perms + author perms (admin pulado)
    expect(txInsert).toHaveBeenCalledTimes(3);
    const seededRoleIds = [
      insertValues.mock.calls[1][0] as RolePermissionValues[],
      insertValues.mock.calls[2][0] as RolePermissionValues[],
    ].map((rows) => rows[0].roleId);
    expect(seededRoleIds).toEqual(["editor-role-id", "author-role-id"]);
  });
});
