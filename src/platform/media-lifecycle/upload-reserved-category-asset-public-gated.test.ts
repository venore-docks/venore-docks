import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadUngated = vi.fn();
vi.mock("@/contexts/media", () => ({
  uploadReservedCategoryAssetPublicUngated: (...args: unknown[]) => uploadUngated(...args),
  restrictReservedCategoryAssets: vi.fn(),
}));

const isAllowed = vi.fn();
vi.mock("@/platform/plugin-engine/is-anonymous-upload-category-allowed", () => ({
  isAnonymousUploadCategoryAllowed: (...args: unknown[]) => isAllowed(...args),
}));

vi.mock("@/plugins/registry", () => ({
  PLUGIN_REGISTRY: [
    {
      key: "vagas",
      anonymousUploadCategories: ["vagas.applications", "vagas.public-files"],
      restrictedUploadCategories: [{ key: "vagas.applications", accessPermission: "vagas.applications.review" }],
    },
  ],
}));

import { uploadReservedCategoryAssetPublicGated } from "./upload-reserved-category-asset-public-gated";

const input = (categoryKey: string) => ({
  filename: "cv.pdf",
  contentType: "application/pdf",
  size: 10,
  data: Buffer.from("%PDF-"),
  categoryKey,
  categoryName: "x",
});

describe("uploadReservedCategoryAssetPublicGated", () => {
  beforeEach(() => {
    uploadUngated.mockReset().mockResolvedValue({ success: true, data: {} });
    isAllowed.mockReset().mockResolvedValue(true);
  });

  it("categoria restrita no manifesto: arquivo nasce restrito com a permission declarada", async () => {
    await uploadReservedCategoryAssetPublicGated(input("vagas.applications"));
    expect(uploadUngated).toHaveBeenCalledWith(expect.objectContaining({ categoryKey: "vagas.applications" }), {
      accessPermission: "vagas.applications.review",
    });
  });

  it("categoria sem restrição: segue privada (sem restriction)", async () => {
    await uploadReservedCategoryAssetPublicGated(input("vagas.public-files"));
    expect(uploadUngated).toHaveBeenCalledWith(expect.objectContaining({ categoryKey: "vagas.public-files" }), undefined);
  });

  it("categoria não liberada pra envio anônimo: recusa sem subir nada", async () => {
    isAllowed.mockResolvedValue(false);
    const result = await uploadReservedCategoryAssetPublicGated(input("outra"));
    expect(result).toMatchObject({ success: false, error: { code: "media.reserved_upload.category_not_allowed" } });
    expect(uploadUngated).not.toHaveBeenCalled();
  });
});
