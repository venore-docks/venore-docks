import { describe, expect, it } from "vitest";
import { canManageAsset, canReadAsset } from "./can-read-asset";

const CV = { visibility: "restricted" as const, uploadedBy: null, accessPermission: "vagas.applications.review" };
const actor = (over: Partial<{ actorId: string; isMediaAdmin: boolean; isSuperadmin: boolean; permissions: string[] }> = {}) => ({
  actorId: "a",
  isMediaAdmin: false,
  isSuperadmin: false,
  permissions: [] as string[],
  ...over,
});

describe("canReadAsset — currículo (restricted)", () => {
  it("nega visitante, usuário comum e admin com media.manage", () => {
    expect(canReadAsset(CV, null)).toBe(false);
    expect(canReadAsset(CV, actor())).toBe(false);
    expect(canReadAsset(CV, actor({ isMediaAdmin: true, permissions: ["media.manage"] }))).toBe(false);
  });

  it("libera RH/gestor com a permission do asset e o superadmin", () => {
    expect(canReadAsset(CV, actor({ permissions: ["vagas.applications.review"] }))).toBe(true);
    expect(canReadAsset(CV, actor({ isSuperadmin: true, isMediaAdmin: true }))).toBe(true);
  });

  it("restrito sem accessPermission: só superadmin e dono", () => {
    const asset = { visibility: "restricted" as const, uploadedBy: "dono", accessPermission: null };
    expect(canReadAsset(asset, actor({ actorId: "dono" }))).toBe(true);
    expect(canReadAsset(asset, actor({ permissions: ["vagas.applications.review"] }))).toBe(false);
  });
});

describe("canReadAsset — public/private (sem mudança)", () => {
  it("público pra todos, privado pra dono e media.manage", () => {
    const priv = { visibility: "private" as const, uploadedBy: "dono", accessPermission: null };
    expect(canReadAsset({ ...priv, visibility: "public" }, null)).toBe(true);
    expect(canReadAsset(priv, actor({ actorId: "dono" }))).toBe(true);
    expect(canReadAsset(priv, actor({ isMediaAdmin: true }))).toBe(true);
    expect(canReadAsset(priv, actor())).toBe(false);
  });
});

describe("canManageAsset", () => {
  it("media.manage não muda visibilidade/categoria de restrito; superadmin muda", () => {
    expect(canManageAsset(CV, actor({ isMediaAdmin: true }))).toBe(false);
    expect(canManageAsset(CV, actor({ isSuperadmin: true, isMediaAdmin: true }))).toBe(true);
  });
});
