import { describe, expect, it } from "vitest";
import { resolveUploadContentType } from "./resolve-upload-content-type";

describe("resolveUploadContentType", () => {
  it("usa o tipo do navegador quando ele conhece o arquivo", () => {
    expect(resolveUploadContentType("foto.jpg", "image/jpeg")).toBe("image/jpeg");
    expect(resolveUploadContentType("IMG_1.HEIC", "image/heic")).toBe("image/heic");
  });

  it("deduz HEIC/HEIF pela extensão quando o navegador manda tipo vazio (Chrome/Edge no Windows)", () => {
    expect(resolveUploadContentType("IMG_1234.HEIC", "")).toBe("image/heic");
    expect(resolveUploadContentType("foto.heif", "application/octet-stream")).toBe("image/heif");
  });

  it("cai em octet-stream pro resto (o servidor recusa)", () => {
    expect(resolveUploadContentType("arquivo.xyz", "")).toBe("application/octet-stream");
    expect(resolveUploadContentType("sem-extensao", "")).toBe("application/octet-stream");
  });
});
