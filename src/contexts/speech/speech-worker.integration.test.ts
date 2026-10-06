import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/infrastructure/database/client";
import { assets } from "@/contexts/media/database/schema";

// Modo worker (SPEECH_DRIVER=worker) contra Postgres real + storage em memória: o worker externo
// reserva, entrega o MP3, falha; o teto do mês segura a reserva.
const settings = { enabled: true, voice: "female", monthlyCharacterLimit: 1_000 };
const dispatch = vi.fn(async () => ({ ok: true }));
vi.mock("@/infrastructure/speech", () => ({
  speechWorkerTrigger: {
    actionsUrl: "https://github.com/x/y/actions/workflows/speech-worker.yml",
    isConfigured: () => true,
    dispatch: () => dispatch(),
    latestRun: async () => null,
  },
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

const {
  syncSpeechAudio,
  processPendingSpeech,
  getSpeechAudio,
  getSpeechWorkStatus,
  claimSpeechWork,
  completeSpeechWork,
  failSpeechWork,
  getSpeechProgress,
  listSpeechQueue,
  retryFailedSpeech,
  reportSpeechWorkProgress,
  recordSpeechWorkerStage,
  getSpeechWorkerActivity,
} = await import("./index");

const mp3 = (text: string) => Buffer.concat([Buffer.from([0xff, 0xf3, 0x44, 0xc4]), Buffer.from(text)]);

describe("speech — worker externo (integração)", () => {
  beforeEach(async () => {
    settings.enabled = true;
    settings.monthlyCharacterLimit = 1_000;
    await db.execute(sql.raw("TRUNCATE TABLE speech.audio_clips, speech.usage_months, speech.sync_cursors, speech.scope_sources, speech.worker_heartbeats"));
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

  it("progresso por faixa, origem no painel, sinal de vida e falhas de volta à fila", async () => {
    await syncSpeechAudio({
      scope: "test.w:2",
      items: [
        { itemKey: "s1", locale: "pt-BR", text: "Primeira cena." },
        { itemKey: "s2", locale: "pt-BR", text: "Segunda cena." },
      ],
      source: { label: "Obra de teste", href: "/admin/novels/works/2" },
    });
    expect(dispatch).toHaveBeenCalled();

    const claim = await claimSpeechWork(1);
    if (!claim.success) throw new Error("claim");
    const [job] = claim.data.jobs;
    expect((await reportSpeechWorkProgress({ id: job.id, textHash: job.textHash, percent: 45 })).success).toBe(true);
    expect(await reportSpeechWorkProgress({ id: job.id, textHash: "outro", percent: 50 })).toEqual({ success: true, data: { active: false } });

    let progress = await getSpeechProgress({ scopes: ["test.w:2", "test.w:nada"] });
    expect(progress.success && progress.data["test.w:2"]).toMatchObject({ total: 2, ready: 0, pending: 1, processing: 1, currentPercent: 45 });
    expect(progress.success && progress.data["test.w:nada"]).toMatchObject({ total: 0, currentPercent: null });

    const queue = await listSpeechQueue();
    expect(queue.success && queue.data.items[0]).toMatchObject({ scope: "test.w:2", label: "Obra de teste", href: "/admin/novels/works/2", total: 2 });

    expect((await recordSpeechWorkerStage({ stage: "preparing", detail: "2 na fila" })).success).toBe(true);
    expect(await getSpeechWorkerActivity()).toMatchObject({ mode: "worker", stage: "preparing" });
    await recordSpeechWorkerStage({ stage: "generating" });
    expect(await getSpeechWorkerActivity()).toMatchObject({ stage: "generating" });
    expect((await recordSpeechWorkerStage({ stage: "dormindo" })).success).toBe(false);

    // Três falhas esgotam as tentativas; "tentar de novo" volta para a fila do zero.
    await failSpeechWork({ id: job.id, textHash: job.textHash, error: "sem memória" });
    for (let round = 0; round < 10; round += 1) {
      const next = await claimSpeechWork(5);
      if (!next.success || next.data.jobs.length === 0) break;
      for (const item of next.data.jobs) await failSpeechWork({ id: item.id, textHash: item.textHash, error: "sem memória" });
    }
    progress = await getSpeechProgress({ scopes: ["test.w:2"] });
    expect(progress.success && progress.data["test.w:2"]).toMatchObject({ failed: 2, lastError: "sem memória" });

    const retried = await retryFailedSpeech({ scope: "test.w:2" });
    expect(retried).toEqual({ success: true, data: { requeued: 2 } });
    progress = await getSpeechProgress({ scopes: ["test.w:2"] });
    expect(progress.success && progress.data["test.w:2"]).toMatchObject({ pending: 2, failed: 0, lastError: null });

    // Scope esvaziado perde a origem.
    await syncSpeechAudio({ scope: "test.w:2", items: [] });
    const empty = await listSpeechQueue();
    expect(empty.success && empty.data.items.find((item) => item.scope === "test.w:2")).toBeUndefined();
  });
});
