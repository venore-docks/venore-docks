import { describe, expect, it } from "vitest";
import { splitTextForSynthesis } from "./split-text";

const bytes = (text: string) => Buffer.byteLength(text, "utf8");

describe("splitTextForSynthesis", () => {
  it("devolve o texto inteiro quando cabe", () => {
    expect(splitTextForSynthesis("  Olá, mundo.  ")).toEqual(["Olá, mundo."]);
    expect(splitTextForSynthesis("   ")).toEqual([]);
  });

  it("corta por parágrafo, depois por frase, sem passar do limite em bytes", () => {
    const paragraph = "Uma frase curta. Outra frase aqui. ".repeat(4).trim();
    const text = [paragraph, paragraph, paragraph].join("\n\n");
    const chunks = splitTextForSynthesis(text, 300);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(bytes(chunk)).toBeLessThanOrEqual(300);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(text.replace(/\s+/g, " "));
  });

  it("conta bytes, não caracteres (japonês ocupa 3 bytes por caractere)", () => {
    const text = "これは長い文です。".repeat(20);
    const chunks = splitTextForSynthesis(text, 100);
    for (const chunk of chunks) expect(bytes(chunk)).toBeLessThanOrEqual(100);
    expect(chunks.join("")).toBe(text);
  });

  it("corta palavra gigante por caractere como último recurso", () => {
    const chunks = splitTextForSynthesis("a".repeat(250), 100);
    expect(chunks).toEqual(["a".repeat(100), "a".repeat(100), "a".repeat(50)]);
  });
});
