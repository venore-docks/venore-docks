import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildExportZip, parseExportZip } from "./zip-codec";

describe("parseExportZip", () => {
  it("round-trips the manifest and the assets folder, ignoring anything else", () => {
    const zip = Buffer.from(
      zipSync({
        "manifest.json": new TextEncoder().encode(JSON.stringify({ ok: true })),
        "assets/a.txt": new TextEncoder().encode("a"),
        "other/b.txt": new TextEncoder().encode("b"),
      }),
    );
    const parsed = parseExportZip(zip);
    expect(parsed.manifest).toEqual({ ok: true });
    expect([...parsed.files.keys()]).toEqual(["assets/a.txt"]);
  });

  it("refuses a package whose declared uncompressed size passes the limit (zip bomb)", () => {
    const zip = buildExportZip({ ok: true }, [{ path: "assets/zeros.bin", data: Buffer.alloc(2 * 1024 * 1024) }]);
    expect(zip.byteLength).toBeLessThan(64 * 1024);
    expect(() => parseExportZip(zip, { maxTotalUncompressedBytes: 1024 * 1024 })).toThrow(/descomprimido/);
  });

  it("refuses a package with too many files", () => {
    const files = Array.from({ length: 5 }, (_, index) => ({ path: `assets/${index}.txt`, data: Buffer.from("x") }));
    expect(() => parseExportZip(buildExportZip({}, files), { maxEntries: 3 })).toThrow(/mais de 3 arquivos/);
  });
});
