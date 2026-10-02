import type { MetadataRoute } from "next";
import { buildWebManifest } from "@/platform/seo/web-manifest";

export const dynamic = "force-dynamic";

// Conteúdo do manifest mora em platform/seo/web-manifest.ts (dono W4/W8, spec v8 §7.7).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  return buildWebManifest();
}
