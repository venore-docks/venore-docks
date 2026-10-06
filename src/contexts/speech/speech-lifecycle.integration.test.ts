import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/infrastructure/database/client";
import { assets } from "@/contexts/media/database/schema";

// Postgres real + storage em memória; só o provedor (Google) e as settings são falsos. Cobre o
// caminho que custa dinheiro: fila, teto do mês, texto trocado e limpeza do MP3.
const settings = { enabled: true, voice: "Kore", monthlyCharacterLimit: 1_000 };
const synthesize = vi.fn(async ({ text }: { text: string }) => ({
  audio: Buffer.concat([Buffer.from([0xff, 0xf3, 0x44, 0xc4]), Buffer.from(text)]),
  contentType: "audio/mpeg",
  billedCharacters: [...text].length,
}));

vi.mock("@/infrastructure/speech", () => ({ speechPort: { model: "fake", isEnabled: () => true, synthesize } }));
vi.mock("./shared/speech-settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./shared/speech-settings")>()),
  readSpeechSettings: async () => settings,
}));

const { syncSpeechAudio, processPendingSpeech, getSpeechAudio, getSpeechStatus } = await import("./index");

async function audioAssetCount(): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(assets).where(eq(assets.contentType, "audio/mpeg"));
  return row.count;
}

describe("speech — ciclo do áudio (integração)", () => {
  beforeEach(async () => {
    settings.enabled = true;
    settings.monthlyCharacterLimit = 1_000;
    synthesize.mockClear();
    await db.execute(sql.raw("TRUNCATE TABLE speech.audio_clips, speech.usage_months, speech.sync_cursors"));
    await db.execute(sql.raw("DELETE FROM media.assets WHERE content_type = 'audio/mpeg'"));
  });

  it("publica, gera uma vez, serve a URL pública e não gera de novo para o mesmo texto", async () => {
    const items = [
      { itemKey: "scene:1", locale: "pt-BR", text: "Era uma vez um farol." },
      { itemKey: "scene:1", locale: "en", text: "Once upon a time." },
    ];
    expect(await syncSpeechAudio({ scope: "test.work:1", items })).toEqual({
      success: true,
      data: { queued: 2, unchanged: 0, removed: 0 },
    });

    const processed = await processPendingSpeech();
    expect(processed.success && processed.data).toEqual({ synthesized: 2, failed: 0, skippedByLimit: 0, remaining: 0 });
    expect(synthesize).toHaveBeenCalledWith(expect.objectContaining({ languageCode: "en-US", voice: "Kore" }));

    const audio = await getSpeechAudio({ scopes: ["test.work:1"] });
    expect(audio.success && audio.data["test.work:1"].map((clip) => clip.locale).sort()).toEqual(["en", "pt-BR"]);

    expect((await syncSpeechAudio({ scope: "test.work:1", items })).success).toBe(true);
    await processPendingSpeech();
    expect(synthesize).toHaveBeenCalledTimes(2);

    const status = await getSpeechStatus();
    expect(status.success && status.data.usedCharacters).toBe(21 + 17);
  });

  it("texto trocado apaga o MP3 velho na hora; despublicar apaga tudo", async () => {
    await syncSpeechAudio({ scope: "test.work:2", items: [{ itemKey: "s", locale: "pt-BR", text: "Primeira versão." }] });
    await processPendingSpeech();
    expect(await audioAssetCount()).toBe(1);

    await syncSpeechAudio({ scope: "test.work:2", items: [{ itemKey: "s", locale: "pt-BR", text: "Segunda versão." }] });
    expect(await audioAssetCount()).toBe(0);
    const pendingAudio = await getSpeechAudio({ scopes: ["test.work:2"] });
    expect(pendingAudio.success && pendingAudio.data["test.work:2"]).toEqual([]);

    await processPendingSpeech();
    expect(await audioAssetCount()).toBe(1);

    const removed = await syncSpeechAudio({ scope: "test.work:2", items: [] });
    expect(removed.success && removed.data.removed).toBe(1);
    expect(await audioAssetCount()).toBe(0);
  });

  it("teto do mês segura a fila sem chamar o provedor", async () => {
    settings.monthlyCharacterLimit = 30;
    await syncSpeechAudio({
      scope: "test.work:3",
      items: [
        { itemKey: "a", locale: "pt-BR", text: "x".repeat(20) },
        { itemKey: "b", locale: "pt-BR", text: "y".repeat(20) },
      ],
    });
    const result = await processPendingSpeech({ concurrency: 1 });
    expect(result.success && result.data).toEqual({ synthesized: 1, failed: 0, skippedByLimit: 1, remaining: 1 });
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it("leitura desligada não mostra áudio nem enfileira", async () => {
    await syncSpeechAudio({ scope: "test.work:4", items: [{ itemKey: "s", locale: "pt-BR", text: "Texto." }] });
    await processPendingSpeech();
    settings.enabled = false;
    const audio = await getSpeechAudio({ scopes: ["test.work:4"] });
    expect(audio.success && audio.data["test.work:4"]).toEqual([]);
    const sync = await syncSpeechAudio({ scope: "test.work:5", items: [{ itemKey: "s", locale: "pt-BR", text: "Outro." }] });
    expect(sync.success && sync.data.queued).toBe(0);
  });
});
