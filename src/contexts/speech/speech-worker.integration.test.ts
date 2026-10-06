import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/infrastructure/database/client";
import { assets } from "@/contexts/media/database/schema";

// Modo worker (SPEECH_DRIVER=worker) contra Postgres real + storage em memória: o worker externo
// reserva, entrega o MP3, falha; o teto do mês segura a reserva.
const settings = { enabled: true, voice: "female", monthlyCharacterLimit: 1_000 };
vi.mock("@/infrastructure/speech", () => ({
  speechPort: {
    kind: "worker",
    model: "worker-v1",
    voices: [
      { key: "female", label: "Feminina" },
      { key: "male", label: "Masculina" },
    ],
    defaultVoice: "female",
    isEnabled: () => true,
    synthesize: async () => {
      throw new Error("não deveria sintetizar no app");
    },
  },
}));
vi.mock("./shared/speech-settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./shared/speech-settings")>()),
  readSpeechSettings: async () => settings,
}));

const { syncSpeechAudio, processPendingSpeech, getSpeechAudio, getSpeechWorkStatus, claimSpeechWork, completeSpeechWork, failSpeechWork } =
  await import("./index");

const mp3 = (text: string) => Buffer.concat([Buffer.from([0xff, 0xf3, 0x44, 0xc4]), Buffer.from(text)]);

describe("speech — worker externo (integração)", () => {
  beforeEach(async () => {
    settings.enabled = true;
    settings.monthlyCharacterLimit = 1_000;
    await db.execute(sql.raw("TRUNCATE TABLE speech.audio_clips, speech.usage_months, speech.sync_cursors"));
    await db.execute(sql.raw("DELETE FROM media.assets WHERE content_type = 'audio/mpeg'"));
  });

  it("o app não sintetiza; o worker reserva, entrega e o áudio fica pronto", async () => {
    await syncSpeechAudio({ scope: "test.w:1", items: [{ itemKey: "s1", locale: "pt-BR", text: "Olá, farol." }] });
    expect((await processPendingSpeech()).success).toBe(true);
    const status = await getSpeechWorkStatus();
    expect(status.success && status.data).toEqual({ mode: "worker", enabled: true, pending: 1 });

    const claim = await claimSpeechWork(10);
    expect(claim.success && claim.data.jobs).toEqual([
      expect.objectContaining({ locale: "pt-BR", languageCode: "pt-BR", voice: "female", text: "Olá, farol." }),
    ]);
    if (!claim.success) return;
    const [job] = claim.data.jobs;
    expect((await claimSpeechWork(10)).success && (await getSpeechWorkStatus()).success).toBe(true);

    const done = await completeSpeechWork({ id: job.id, textHash: job.textHash, contentType: "audio/mpeg", audio: mp3("ok") });
    expect(done).toEqual({ success: true, data: { stored: true } });
    const audio = await getSpeechAudio({ scopes: ["test.w:1"] });
    expect(audio.success && audio.data["test.w:1"]).toHaveLength(1);
  });

  it("entrega de texto que mudou no meio é descartada sem gravar mídia", async () => {
    await syncSpeechAudio({ scope: "test.w:2", items: [{ itemKey: "s", locale: "en", text: "First." }] });
    const claim = await claimSpeechWork(5);
    if (!claim.success) throw new Error("claim");
    const [job] = claim.data.jobs;
    await syncSpeechAudio({ scope: "test.w:2", items: [{ itemKey: "s", locale: "en", text: "Second." }] });
    expect(await completeSpeechWork({ id: job.id, textHash: job.textHash, contentType: "audio/mpeg", audio: mp3("x") })).toEqual({
      success: true,
      data: { stored: false },
    });
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(assets).where(eq(assets.contentType, "audio/mpeg"));
    expect(row.count).toBe(0);
  });

  it("falha devolve a cota; teto do mês segura a reserva", async () => {
    settings.monthlyCharacterLimit = 25;
    await syncSpeechAudio({
      scope: "test.w:3",
      items: [
        { itemKey: "a", locale: "pt-BR", text: "x".repeat(20) },
        { itemKey: "b", locale: "pt-BR", text: "y".repeat(20) },
      ],
    });
    const first = await claimSpeechWork(10);
    expect(first.success && first.data.jobs).toHaveLength(1);
    expect(first.success && first.data.limitReached).toBe(true);
    if (!first.success) return;

    const [job] = first.data.jobs;
    await failSpeechWork({ id: job.id, textHash: job.textHash, error: "modelo não baixou" });
    const again = await claimSpeechWork(10);
    expect(again.success && again.data.jobs).toHaveLength(1);
  });

  it("recusa corpo que não é MP3", async () => {
    await syncSpeechAudio({ scope: "test.w:4", items: [{ itemKey: "s", locale: "pt-BR", text: "Oi." }] });
    const claim = await claimSpeechWork(1);
    if (!claim.success) throw new Error("claim");
    const [job] = claim.data.jobs;
    const result = await completeSpeechWork({ id: job.id, textHash: job.textHash, contentType: "audio/wav", audio: mp3("x") });
    expect(result.success).toBe(false);
  });
});
