import { beforeEach, describe, expect, it, vi } from "vitest";
import { speechTextHash } from "../../shared/language";

const store = {
  listClipsByScope: vi.fn(),
  upsertPendingClip: vi.fn(),
  deleteClips: vi.fn(),
};
const deleteGeneratedAssets = vi.fn();
const scheduleSpeechProcessing = vi.fn();
const settings = { enabled: true, voice: "Kore", monthlyCharacterLimit: 900_000 };
const port = { enabled: true };

vi.mock("../../shared/store", () => store);
vi.mock("@/contexts/media", () => ({ deleteGeneratedAssets: (...args: unknown[]) => deleteGeneratedAssets(...args) }));
vi.mock("@/infrastructure/speech", () => ({ speechPort: { model: "m", isEnabled: () => port.enabled } }));
vi.mock("../../shared/speech-settings", () => ({ readSpeechSettings: async () => settings }));
vi.mock("../process-pending-speech/service", () => ({ scheduleSpeechProcessing: () => scheduleSpeechProcessing() }));
vi.mock("@/observability", () => ({ beginOperation: () => ({}), endOperation: () => {} }));

const { syncSpeechAudio } = await import("./service");

const clip = (overrides: Record<string, unknown>) => ({
  id: "c1",
  scope: "s",
  itemKey: "body",
  locale: "pt-BR",
  text: "Olá",
  voice: "Kore",
  textHash: speechTextHash({ model: "m", voice: "Kore", languageCode: "pt-BR", text: "Olá" }),
  characters: 3,
  status: "ready",
  attempts: 0,
  mediaAssetId: "a1",
  ...overrides,
});

describe("syncSpeechAudio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings.enabled = true;
    port.enabled = true;
    store.listClipsByScope.mockResolvedValue([]);
    deleteGeneratedAssets.mockResolvedValue({ success: true, data: { deleted: 0 } });
  });

  it("texto novo entra na fila e dispara a geração", async () => {
    const result = await syncSpeechAudio({ scope: "s", items: [{ itemKey: "body", locale: "pt-BR", text: "  Olá  " }] });
    expect(result).toEqual({ success: true, data: { queued: 1, unchanged: 0, removed: 0 } });
    expect(store.upsertPendingClip).toHaveBeenCalledWith(expect.objectContaining({ text: "Olá", voice: "Kore", characters: 3 }));
    expect(scheduleSpeechProcessing).toHaveBeenCalledOnce();
  });

  it("texto igual não gasta nada", async () => {
    store.listClipsByScope.mockResolvedValue([clip({})]);
    const result = await syncSpeechAudio({ scope: "s", items: [{ itemKey: "body", locale: "pt-BR", text: "Olá" }] });
    expect(result.success && result.data).toEqual({ queued: 0, unchanged: 1, removed: 0 });
    expect(store.upsertPendingClip).not.toHaveBeenCalled();
    expect(deleteGeneratedAssets).not.toHaveBeenCalled();
    expect(scheduleSpeechProcessing).not.toHaveBeenCalled();
  });

  it("texto mudado volta para a fila e o MP3 velho é apagado", async () => {
    store.listClipsByScope.mockResolvedValue([clip({})]);
    await syncSpeechAudio({ scope: "s", items: [{ itemKey: "body", locale: "pt-BR", text: "Olá de novo" }] });
    expect(store.upsertPendingClip).toHaveBeenCalledOnce();
    expect(deleteGeneratedAssets).toHaveBeenCalledWith({ ids: ["a1"], categoryKey: "speech" });
  });

  it("item que saiu da lista perde clip e MP3; lista vazia limpa o scope", async () => {
    store.listClipsByScope.mockResolvedValue([clip({}), clip({ id: "c2", itemKey: "x", mediaAssetId: null })]);
    const result = await syncSpeechAudio({ scope: "s", items: [] });
    expect(result.success && result.data.removed).toBe(2);
    expect(store.deleteClips).toHaveBeenCalledWith(["c1", "c2"]);
    expect(deleteGeneratedAssets).toHaveBeenCalledWith({ ids: ["a1"], categoryKey: "speech" });
  });

  it("desligada: não enfileira nada, mas texto mudado ainda perde o áudio velho", async () => {
    settings.enabled = false;
    store.listClipsByScope.mockResolvedValue([clip({})]);
    const result = await syncSpeechAudio({
      scope: "s",
      items: [
        { itemKey: "body", locale: "pt-BR", text: "Mudou" },
        { itemKey: "novo", locale: "pt-BR", text: "Novo" },
      ],
    });
    expect(result.success && result.data).toEqual({ queued: 0, unchanged: 0, removed: 1 });
    expect(store.upsertPendingClip).not.toHaveBeenCalled();
    expect(deleteGeneratedAssets).toHaveBeenCalledWith({ ids: ["a1"], categoryKey: "speech" });
  });

  it("ignora idioma sem voz, texto vazio e item repetido", async () => {
    const result = await syncSpeechAudio({
      scope: "s",
      items: [
        { itemKey: "a", locale: "xx", text: "texto" },
        { itemKey: "b", locale: "en", text: "   " },
        { itemKey: "c", locale: "en", text: "Hi" },
        { itemKey: "c", locale: "en", text: "Hi again" },
      ],
    });
    expect(result.success && result.data.queued).toBe(1);
  });

  it("falha anterior com o mesmo texto tenta de novo", async () => {
    store.listClipsByScope.mockResolvedValue([clip({ status: "failed", mediaAssetId: null })]);
    const result = await syncSpeechAudio({ scope: "s", items: [{ itemKey: "body", locale: "pt-BR", text: "Olá" }] });
    expect(result.success && result.data.queued).toBe(1);
  });
});
