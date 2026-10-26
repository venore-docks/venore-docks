import { beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn();
vi.mock("@/contexts/media", () => ({
  uploadReservedCategoryAsset: (...args: unknown[]) => upload(...args),
  restrictReservedCategoryAssets: vi.fn(),
}));

vi.mock("@/plugins/registry", () => ({
  PLUGIN_REGISTRY: [
    {
      key: "listas-materiais",
      restrictedUploadCategories: [{ key: "listas-materiais.arquivos", accessPermission: "listas-materiais.read" }],
    },
  ],
}));

import { uploadReservedCategoryAssetGated } from "./upload-reserved-category-asset-gated";

const input = (categoryKey: string) => ({
  filename: "capa.pdf",
  contentType: "application/pdf",
  size: 10,
  data: Buffer.from("%PDF-"),
  categoryKey,
  categoryName: "x",
});

describe("uploadReservedCategoryAssetGated", () => {
  beforeEach(() => {
    upload.mockReset().mockResolvedValue({ success: true, data: {} });
  });

  it("categoria restrita no manifesto: arquivo já nasce restrito com a permission declarada", async () => {
    await uploadReservedCategoryAssetGated(input("listas-materiais.arquivos"));
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ categoryKey: "listas-materiais.arquivos" }), {
      accessPermission: "listas-materiais.read",
    });
  });

  it("categoria sem restrição: segue privada (sem restriction)", async () => {
    await uploadReservedCategoryAssetGated(input("outro-plugin.entregas"));
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ categoryKey: "outro-plugin.entregas" }), undefined);
  });
});
