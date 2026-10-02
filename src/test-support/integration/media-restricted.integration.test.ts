import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/infrastructure/database/client";
import { assets } from "@/contexts/media/database/schema";
import { uploadReservedCategoryAsset } from "@/contexts/media/features/assets/upload-reserved-category-asset/service";
import { restrictReservedCategoryAssets } from "@/contexts/media/features/assets/restrict-reserved-category-assets/service";
import { getMediaAsset } from "@/contexts/media/features/assets/get-media-asset/service";
import { listMediaAssets } from "@/contexts/media/features/assets/list-media-assets/service";
import { readMediaAsset } from "@/contexts/media/features/assets/read-media-asset/service";
import { seedUser } from "./user-seed";

// Mídia restrita ponta a ponta contra Postgres real: currículo enviado antes da regra (private)
// vira restricted pela aplicação retroativa; media.manage deixa de ver/ler/listar; quem tem a
// permission do asset e o superadmin continuam lendo.

const PDF = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
const PERMISSION = "vagas.applications.review";

async function uploadResume() {
  const result = await uploadReservedCategoryAsset({
    filename: "cv.pdf",
    contentType: "application/pdf",
    size: PDF.byteLength,
    data: PDF,
    categoryKey: "vagas.applications",
    categoryName: "Currículos",
    allowedMimeCategories: ["document"],
    actorId: null,
  });
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}

describe("media — arquivo restrito (currículos)", () => {
  it("upload com restriction já nasce restrito", async () => {
    const result = await uploadReservedCategoryAsset({
      filename: "cv.pdf",
      contentType: "application/pdf",
      size: PDF.byteLength,
      data: PDF,
      categoryKey: "vagas.applications",
      categoryName: "Currículos",
      actorId: null,
      restriction: { accessPermission: PERMISSION },
    });
    expect(result.success && result.data.visibility).toBe("restricted");
    expect(result.success && result.data.accessPermission).toBe(PERMISSION);
  });

  it("aplicação retroativa fecha o currículo antigo pra media.manage e libera pro RH", async () => {
    const resume = await uploadResume();
    expect(resume.visibility).toBe("private");

    const first = await restrictReservedCategoryAssets({ categoryKey: "vagas.applications", accessPermission: PERMISSION });
    expect(first.success && first.data.restricted).toBeGreaterThanOrEqual(1);
    const again = await restrictReservedCategoryAssets({ categoryKey: "vagas.applications", accessPermission: PERMISSION });
    expect(again.success && again.data.restricted).toBe(0);

    const [row] = await db.select().from(assets).where(eq(assets.id, resume.id));
    expect(row.visibility).toBe("restricted");
    expect(row.accessPermission).toBe(PERMISSION);

    const admin = await seedUser();
    const rh = await seedUser();
    const adminScope = { actorId: admin.id, isMediaAdmin: true, isSuperadmin: false, permissions: ["media.manage"] };
    const rhScope = { actorId: rh.id, isMediaAdmin: false, isSuperadmin: false, permissions: [PERMISSION] };
    const rootScope = { actorId: admin.id, isMediaAdmin: true, isSuperadmin: true, permissions: [] };

    expect(await getMediaAsset({ id: resume.id }, adminScope)).toEqual({ success: true, data: null });
    expect((await readMediaAsset({ id: resume.id }, adminScope)).success).toBe(false);
    const adminList = await listMediaAssets(adminScope);
    expect(adminList.success && adminList.data.some((item) => item.id === resume.id)).toBe(false);
    const rootList = await listMediaAssets(rootScope);
    expect(rootList.success && rootList.data.some((item) => item.id === resume.id)).toBe(true);

    expect((await readMediaAsset({ id: resume.id }, rhScope)).success).toBe(true);
    expect((await readMediaAsset({ id: resume.id }, rootScope)).success).toBe(true);
  });
});
