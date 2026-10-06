import { describe, expect, it, vi } from "vitest";
import { GoogleCloudTtsAdapter } from "./google-cloud-tts-adapter";

function audioResponse(bytes: number[]): Response {
  return new Response(JSON.stringify({ audioContent: Buffer.from(bytes).toString("base64") }), { status: 200 });
}

describe("GoogleCloudTtsAdapter", () => {
  it("manda a chave no header, monta o nome da voz Chirp 3 HD e devolve o MP3", async () => {
    const fetchMock = vi.fn(async () => audioResponse([0xff, 0xf3, 1, 2]));
    const adapter = new GoogleCloudTtsAdapter("chave-teste", fetchMock as unknown as typeof fetch);

    const result = await adapter.synthesize({ text: "Olá", languageCode: "pt-BR", voice: "Kore" });

    expect(result).toEqual({ audio: Buffer.from([0xff, 0xf3, 1, 2]), contentType: "audio/mpeg", billedCharacters: 3 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("chave-teste");
    expect((init.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe("chave-teste");
    expect(JSON.parse(String(init.body))).toEqual({
      input: { text: "Olá" },
      voice: { languageCode: "pt-BR", name: "pt-BR-Chirp3-HD-Kore" },
      audioConfig: { audioEncoding: "MP3" },
    });
  });

  it("texto longo vira várias chamadas e o ID3 dos pedaços seguintes sai", async () => {
    const id3 = [0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 2, 0xaa, 0xbb];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(audioResponse([...id3, 1]))
      .mockResolvedValueOnce(audioResponse([...id3, 2]));
    const adapter = new GoogleCloudTtsAdapter("k", fetchMock as unknown as typeof fetch);

    const result = await adapter.synthesize({ text: `${"a ".repeat(1500)}\n\n${"b ".repeat(1500)}`, languageCode: "en-US", voice: "Puck" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect([...result.audio]).toEqual([...id3, 1, 2]);
  });

  it("erro da API vira exceção com a mensagem do Google", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { message: "API key not valid." } }), { status: 400 }));
    const adapter = new GoogleCloudTtsAdapter("k", fetchMock as unknown as typeof fetch);
    await expect(adapter.synthesize({ text: "x", languageCode: "pt-BR", voice: "Kore" })).rejects.toThrow("API key not valid.");
  });
});
