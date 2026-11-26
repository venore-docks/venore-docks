import { describe, expect, it } from "vitest";
import { RBAC_PERMISSIONS } from "@/contexts/rbac";
import { buildPermissionGroups } from "./permission-catalog";

// Nenhuma permissão do core pode chegar à tela /admin/rbac com a própria chave como texto
// (ex.: "rbac.roles.manage" cru no lugar de "Criar e editar papéis").
describe("catálogo de permissões do /admin/rbac", () => {
  const groups = buildPermissionGroups(RBAC_PERMISSIONS);
  const views = groups.flatMap((group) => group.permissions);

  it("toda permissão do core tem título e descrição legíveis, nunca a chave crua", () => {
    for (const permission of RBAC_PERMISSIONS) {
      const view = views.find((item) => item.key === permission.key);
      expect(view, permission.key).toBeDefined();
      for (const text of [view!.title, view!.description]) {
        expect(text.trim().length).toBeGreaterThan(0);
        expect(text).not.toBe(permission.key);
        expect(text).not.toMatch(/^[a-z-]+(\.[a-z-]+){2,}$/);
      }
    }
  });

  it("rbac.roles.manage, rbac.roles.assign e rbac.registrations.approve ficam em Pessoas e acessos", () => {
    const people = groups.find((group) => group.id === "people-and-access");
    const keys = people?.permissions.map((permission) => permission.key) ?? [];
    expect(keys).toEqual(expect.arrayContaining(["rbac.roles.manage", "rbac.roles.assign", "rbac.registrations.approve"]));
  });
});
