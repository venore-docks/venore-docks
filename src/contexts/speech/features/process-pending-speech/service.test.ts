import { beforeEach, describe, expect, it, vi } from "vitest";

const store = {
  claimPendingClips: vi.fn(),
  countClipsByStatus: vi.fn(),
  markClipReady: vi.fn(),
  recordClipFailure: vi.fn(),
  refundUsage: vi.fn(),
  releaseClip: vi.fn(),
  reserveUsage: vi.fn(),
};
const media = { storeGeneratedAsset: vi.fn(), deleteGeneratedAssets: vi.fn() };
const synthesize = vi.fn();
const settings = { enabled: true, voice: "Kore", monthlyCharacterLimit: 100 };

vi.mock("../../shared/store", () => store);
vi.mock("@/contexts/media", () => media);
vi.mock("@/infrastructure/speech", () => ({ speechPort: { kind: "inline", model: "m", isEnabled: () => true, synthesize: (...a: unknown[]) => synthesize(...a) } }));
vi.mock("../../shared/speech-settings", () => ({ readSpeechSettings: async () => settings }));
vi.mock("@/observability", () => ({ beginOperation: () => ({}), endOperation: () => {} }));
vi.mock("@vercel/functions", () => ({ waitUntil: () => {} }));

const { processPendingSpeech } = await import("./service");

const clip = (id: string, characters = 10) => ({
  id,
  scope: "s",
  itemKey: id,
  locale: "pt-BR",
  text: "x".repeat(characters),
  voice: "Kore",
  textHash: `h-${id}`,
  characters,
  status: "processing",
  attempts: 0,
  mediaAssetId: null,
});

describe("processPendingSpeech", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings.enabled = true;
    store.countClipsByStatus.mockResolvedValue({ pending: 0, processing: 0, ready: 0, failed: 0 });
    store.reserveUsage.mockResolvedValue(true);
    store.markClipReady.mockResolvedValue(true);
    synthesize.mockResolvedValue({ audio: Buffer.from([0xff, 0xf3]), contentType: "audio/mpeg", billedCharacters: 10 });
    media.storeGeneratedAsset.mockResolvedValue({ success: true, data: { id: "asset-1" } });
  });

  it("sintetiza, grava como mídia pública da categoria speech e marca pronto", async () => {
    store.claimPendingClips.mockResolvedValueOnce([clip("a")]).mockResolvedValueOnce([]);
    const result = await processPendingSpeech();
    expect(result).toEqual({ success: true, data: { synthesized: 1, failed: 0, skippedByLimit: 0, remaining: 0 } });
    expect(synthesize).toHaveBeenCalledWith({ text: "x".repeat(10), languageCode: "pt-BR", voice: "Kore" });
    expect(media.storeGeneratedAsset).toHaveBeenCalledWith(expect.objectContaining({ categoryKey: "speech", contentType: "audio/mpeg" }));
    expect(store.markClipReady).toHaveBeenCalledWith("a", "h-a", "asset-1");
  });

  it("teto do mês: não chama o Google, devolve o clip para a fila e para", async () => {
    store.claimPendingClips.mockResolvedValueOnce([clip("a")]);
    store.reserveUsage.mockResolvedValue(false);
    const result = await processPendingSpeech();
    expect(result.success && result.data.skippedByLimit).toBe(1);
    expect(synthesize).not.toHaveBeenCalled();
    expect(store.releaseClip).toHaveBeenCalledWith("a", "h-a");
    expect(store.claimPendingClips).toHaveBeenCalledTimes(1);
  });

  it("erro do provedor devolve a reserva da cota e conta tentativa", async () => {
    store.claimPendingClips.mockResolvedValueOnce([clip("a")]).mockResolvedValueOnce([]);
    synthesize.mockRejectedValue(new Error("API key not valid."));
    const result = await processPendingSpeech();
    expect(result.success && result.data.failed).toBe(1);
    expect(store.refundUsage).toHaveBeenCalledWith(expect.any(String), 10);
    expect(store.recordClipFailure).toHaveBeenCalledWith("a", "h-a", "API key not valid.", 3);
    expect(media.storeGeneratedAsset).not.toHaveBeenCalled();
  });

  it("texto mudou durante a síntese: o MP3 novo é descartado", async () => {
    store.claimPendingClips.mockResolvedValueOnce([clip("a")]).mockResolvedValueOnce([]);
    store.markClipReady.mockResolvedValue(false);
    await processPendingSpeech();
    expect(media.deleteGeneratedAssets).toHaveBeenCalledWith({ ids: ["asset-1"], categoryKey: "speech" });
  });

  it("desligada: não reserva nem sintetiza nada", async () => {
    settings.enabled = false;
    store.countClipsByStatus.mockResolvedValue({ pending: 4, processing: 0, ready: 0, failed: 0 });
    const result = await processPendingSpeech();
    expect(result.success && result.data.remaining).toBe(4);
    expect(store.claimPendingClips).not.toHaveBeenCalled();
  });
});
