import sharp from "sharp";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/infrastructure/database/client";
import { storagePort } from "@/infrastructure/storage";
import { assetVariants, assets } from "@/contexts/media/database/schema";
import { uploadMediaAsset } from "@/contexts/media/features/assets/upload-media-asset/service";
import { getMediaAsset } from "@/contexts/media/features/assets/get-media-asset/service";
import { readMediaAsset } from "@/contexts/media/features/assets/read-media-asset/service";
import { backfillAssetVariants } from "@/contexts/media/features/assets/backfill-asset-variants/service";
import { purgeMediaAsset } from "@/contexts/media/features/assets/purge-media-asset/service";
import { seedUser } from "./user-seed";

// Variantes de imagem ponta a ponta contra Postgres real + storage em memória: upload gera,
// leitura anexa e serve por largura, backfill cobre asset antigo, purge limpa tudo.

const photo = (width = 1200, height = 600) =>
  sharp({ create: { width, height, channels: 3, background: "#aa3355" } }).jpeg({ quality: 95 }).toBuffer();

describe("media — variantes de imagem", () => {
  it("upload gera as variantes, a leitura anexa e serve a largura pedida", async () => {
    const actor = await seedUser();
    const data = await photo();

    const uploaded = await uploadMediaAsset({
      filename: "foto.jpg",
      contentType: "image/jpeg",
      size: data.byteLength,
      data,
      visibility: "public",
      actorId: actor.id,
    });
    expect(uploaded.success).toBe(true);
    if (!uploaded.success) return;
    expect(uploaded.data.variants?.map((variant) => variant.width)).toEqual([160, 480, 960, 1200]);

    const [row] = await db.select().from(assets).where(eq(assets.id, uploaded.data.id));
    expect(row.width).toBe(1200);
    expect(row.height).toBe(600);
    expect(row.variantsProcessedAt).not.toBeNull();

    const fetched = await getMediaAsset({ id: uploaded.data.id }, { actorId: actor.id, isMediaAdmin: false, isSuperadmin: false, permissions: [] });
    expect(fetched.success && fetched.data?.variants?.[1]).toMatchObject({ width: 480, height: 240, contentType: "image/webp" });

    const served = await readMediaAsset({ id: uploaded.data.id, width: 480 }, null);
    expect(served.success && served.data.contentType).toBe("image/webp");
    const original = await readMediaAsset({ id: uploaded.data.id }, null);
    expect(original.success && original.data.contentType).toBe("image/jpeg");

    // Driver filesystem serve por pathname — a variante precisa resolver pro asset dono.
    const [variant] = await db.select().from(assetVariants).where(eq(assetVariants.assetId, uploaded.data.id)).limit(1);
    const byPathname = await readMediaAsset({ pathname: variant.pathname }, null);
    expect(byPathname.success).toBe(true);
  });

  it("backfill gera variantes de asset antigo e purge apaga variantes do storage", async () => {
    const actor = await seedUser();
    const data = await photo(800, 800);
    const pathname = `Imagens/${crypto.randomUUID()}-antiga.jpg`;
    await storagePort.store({ key: pathname, data, contentType: "image/jpeg" });
    const [legacy] = await db
      .insert(assets)
      .values({
        filename: "antiga.jpg",
        pathname,
        url: storagePort.resolveUrl(pathname),
        contentType: "image/jpeg",
        size: data.byteLength,
        checksum: "legacy",
        visibility: "public",
        uploadedBy: actor.id,
      })
      .returning();

    const batch = await backfillAssetVariants({ limit: 20, actorId: actor.id });
    expect(batch.success && batch.data.remaining).toBe(0);
    const variants = await db.select().from(assetVariants).where(eq(assetVariants.assetId, legacy.id));
    expect(variants.map((variant) => variant.width).sort((a, b) => a - b)).toEqual([160, 480, 800]);

    await db.update(assets).set({ deletedAt: new Date() }).where(eq(assets.id, legacy.id));
    const purged = await purgeMediaAsset({ id: legacy.id, actorId: actor.id });
    expect(purged.success).toBe(true);
    expect(await db.select().from(assetVariants).where(eq(assetVariants.assetId, legacy.id))).toEqual([]);
    for (const variant of variants) {
      expect(await storagePort.stat(variant.pathname)).toBeNull();
    }
  });
});
