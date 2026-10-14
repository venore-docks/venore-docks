import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enabled: true,
  cursor: null as Date | null,
  entries: [] as { id: string; title: string; updatedAt: Date; text: string }[],
  scopes: [] as string[],
  keeping: [] as string[],
  syncSpeechAudio: vi.fn(async (input: { scope: string; items: unknown[] }) => ({
    success: true as const,
    data: { queued: input.items.length, unchanged: 0, removed: input.items.length === 0 ? 1 : 0 },
  })),
  setSpeechSyncCursor: vi.fn(),
  listPublishedEntryTexts: vi.fn(),
}));

vi.mock("@/contexts/cms", () => ({
  listPublishedEntryTexts: (query: unknown) => mocks.listPublishedEntryTexts(query),
  filterEntryIdsKeepingSpeech: async () => mocks.keeping,
}));
vi.mock("@/contexts/settings", () => ({ getSetting: async () => ({ success: true, data: { value: "en" } }) }));
vi.mock("@/contexts/speech", () => ({
  readSpeechSettings: async () => ({ enabled: mocks.enabled, voice: "Kore", monthlyCharacterLimit: 900_000 }),
  getSpeechSyncCursor: async () => mocks.cursor,
  setSpeechSyncCursor: (key: string, at: Date) => mocks.setSpeechSyncCursor(key, at),
  listSpeechScopes: async () => mocks.scopes,
  syncSpeechAudio: (input: { scope: string; items: unknown[] }) => mocks.syncSpeechAudio(input),
}));

const { syncCmsEntrySpeech } = await import("./sync-cms-entry-speech");

describe("syncCmsEntrySpeech", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled = true;
    mocks.cursor = null;
    mocks.scopes = [];
    mocks.keeping = [];
    mocks.listPublishedEntryTexts.mockImplementation(async () => mocks.entries);
  });

  it("desligada: não lê entries nem avança o cursor", async () => {
    mocks.enabled = false;
    expect(await syncCmsEntrySpeech()).toEqual({ success: true, data: { synced: 0, removed: 0 } });
    expect(mocks.listPublishedEntryTexts).not.toHaveBeenCalled();
    expect(mocks.setSpeechSyncCursor).not.toHaveBeenCalled();
  });

  it("sincroniza as entries que mudaram no idioma do site e avança o cursor até a última", async () => {
    const t1 = new Date("2026-10-01T10:00:00Z");
    const t2 = new Date("2026-10-02T10:00:00Z");
    mocks.cursor = new Date("2026-09-30T00:00:00Z");
    mocks.entries = [
      { id: "e1", title: "Primeira", updatedAt: t1, text: "Um" },
      { id: "e2", title: "Segunda", updatedAt: t2, text: "Dois" },
    ];
    const result = await syncCmsEntrySpeech();
    expect(result).toEqual({ success: true, data: { synced: 2, removed: 0 } });
    expect(mocks.listPublishedEntryTexts).toHaveBeenCalledWith({ updatedAfter: mocks.cursor, limit: 50 });
    expect(mocks.syncSpeechAudio).toHaveBeenCalledWith({
      scope: "cms.entry:e1",
      items: [{ itemKey: "body", locale: "en", text: "Um" }],
      source: { label: "Primeira", href: "/admin/cms/entries/e1" },
    });
    expect(mocks.setSpeechSyncCursor).toHaveBeenLastCalledWith("cms.entries", t2);
  });

  it("remove o áudio de entry que não pode mais tê-lo (arquivada, apagada, só logado)", async () => {
    mocks.entries = [];
    mocks.scopes = ["cms.entry:mantem", "cms.entry:arquivada"];
    mocks.keeping = ["mantem"];
    const result = await syncCmsEntrySpeech();
    expect(result).toEqual({ success: true, data: { synced: 0, removed: 1 } });
    expect(mocks.syncSpeechAudio).toHaveBeenCalledTimes(1);
    expect(mocks.syncSpeechAudio).toHaveBeenCalledWith({ scope: "cms.entry:arquivada", items: [] });
  });
});
