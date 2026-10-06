import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/speech", () => ({
  syncSpeechAudio: async () => ({ success: true, data: { queued: 0, unchanged: 0, removed: 0 } }),
  getSpeechAudio: async () => ({ success: true, data: {} }),
  processPendingSpeech: async () => ({ success: true }),
  setSpeechSyncCursor: async () => undefined,
  getSpeechStatus: async () => ({ success: true }),
}));

describe("@venore/plugin-sdk/speech", () => {
  it("expõe só sincronizar e ler", async () => {
    const sdk = (await import("./speech")) as Record<string, unknown>;
    expect(typeof sdk.syncSpeechAudio).toBe("function");
    expect(typeof sdk.getSpeechAudio).toBe("function");
    for (const name of ["processPendingSpeech", "setSpeechSyncCursor", "getSpeechStatus", "scheduleSpeechProcessing"]) {
      expect(sdk[name]).toBeUndefined();
    }
  });
});
