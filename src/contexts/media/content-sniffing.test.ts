import { describe, expect, it } from "vitest";
import { contentMatchesDeclaredType } from "./content-sniffing";

const bytes = (...parts: (string | number[])[]) =>
  Buffer.concat(parts.map((part) => (typeof part === "string" ? Buffer.from(part, "latin1") : Buffer.from(part))));

describe("contentMatchesDeclaredType", () => {
  it.each([
    ["image/png", bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "rest")],
    ["image/jpeg", bytes([0xff, 0xd8, 0xff, 0xe0])],
    ["image/gif", bytes("GIF89a")],
    ["image/webp", bytes("RIFF", [1, 2, 3, 4], "WEBPVP8 ")],
    ["image/svg+xml", bytes('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>')],
    ["application/pdf", bytes("%PDF-1.7\n")],
    ["video/mp4", bytes([0, 0, 0, 0x18], "ftypmp42")],
    ["video/webm", bytes([0x1a, 0x45, 0xdf, 0xa3])],
    ["audio/mpeg", bytes("ID3", [4, 0])],
    ["audio/mpeg", bytes([0xff, 0xfb, 0x90])],
    ["audio/wav", bytes("RIFF", [1, 2, 3, 4], "WAVEfmt ")],
    ["audio/ogg", bytes("OggS")],
  ])("accepts real %s content", (contentType, content) => {
    expect(contentMatchesDeclaredType(contentType, content)).toBe(true);
  });

  it("refuses HTML, scripts and binaries labelled as something else", () => {
    expect(contentMatchesDeclaredType("image/png", bytes("<html><script>alert(1)</script>"))).toBe(false);
    expect(contentMatchesDeclaredType("application/pdf", bytes("MZ", [0x90, 0]))).toBe(false);
    expect(contentMatchesDeclaredType("image/svg+xml", bytes([0x89, 0x50, 0x4e, 0x47, 0]))).toBe(false);
    expect(contentMatchesDeclaredType("image/webp", bytes("RIFF", [1, 2, 3, 4], "WAVE"))).toBe(false);
  });

  it("refuses any type outside the allowlist", () => {
    expect(contentMatchesDeclaredType("text/html", bytes("<html>"))).toBe(false);
  });
});
