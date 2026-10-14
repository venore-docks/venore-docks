import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorized: true,
  setSetting: vi.fn(async (input: { key: string; value: unknown }) => {
    void input;
    return { success: true as const, data: {} };
  }),
  revalidatePath: vi.fn(),
  retryFailedSpeech: vi.fn(async (input: { scope?: string | null }) => {
    void input;
    return { success: true as const, data: { requeued: 2 } };
  }),
  requestSpeechWorkerRun: vi.fn(async () => ({ success: true as const, data: { dispatched: true as const } })),
  regenerateSpeech: vi.fn(async (input: { scope: string }) => {
    void input;
    return { success: true as const, data: { requeued: 3 } };
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/contexts/rbac", () => ({
  authorizeActor: async (permission: string) =>
    mocks.authorized && permission === "settings.manage"
      ? { authorized: true, actorId: "u1" }
      : { authorized: false, error: { code: "rbac.forbidden", message: "Sem permissão." } },
}));
vi.mock("@/contexts/settings", () => ({ setSetting: mocks.setSetting }));
vi.mock("@/contexts/speech", () => ({
  isSpeechVoice: (value: string) => ["Kore", "Puck"].includes(value),
  MAX_MONTHLY_CHARACTER_LIMIT: 50_000_000,
  SPEECH_ENABLED_SETTING_KEY: "speech.enabled",
  SPEECH_VOICE_SETTING_KEY: "speech.voice",
  SPEECH_MONTHLY_LIMIT_SETTING_KEY: "speech.monthly_character_limit",
  retryFailedSpeech: mocks.retryFailedSpeech,
  requestSpeechWorkerRun: mocks.requestSpeechWorkerRun,
  regenerateSpeech: mocks.regenerateSpeech,
}));

const { updateSpeechSettingsAction, retryFailedSpeechAction, requestSpeechWorkerRunAction, regenerateSpeechAction } =
  await import("./actions");

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

beforeEach(() => {
  mocks.authorized = true;
  mocks.setSetting.mockClear();
  mocks.revalidatePath.mockClear();
  mocks.retryFailedSpeech.mockClear();
  mocks.requestSpeechWorkerRun.mockClear();
  mocks.regenerateSpeech.mockClear();
});

describe("updateSpeechSettingsAction", () => {
  it("sem settings.manage: erro e nada gravado", async () => {
    mocks.authorized = false;
    expect(await updateSpeechSettingsAction({ error: null }, form({ enabled: "on" }))).toEqual({ error: "Sem permissão." });
    expect(mocks.setSetting).not.toHaveBeenCalled();
  });

  it("grava ligado, voz e teto (aceita separador de milhar)", async () => {
    const state = await updateSpeechSettingsAction({ error: null }, form({ enabled: "on", voice: "Puck", monthlyCharacterLimit: "900.000" }));
    expect(state).toEqual({ error: null });
    expect(mocks.setSetting.mock.calls.map(([input]) => input)).toEqual([
      { key: "speech.enabled", value: true },
      { key: "speech.voice", value: "Puck" },
      { key: "speech.monthly_character_limit", value: 900_000 },
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("recusa voz fora da lista e teto inválido", async () => {
    expect((await updateSpeechSettingsAction({ error: null }, form({ voice: "Outra", monthlyCharacterLimit: "10" }))).error).toMatch(/voz/);
    expect((await updateSpeechSettingsAction({ error: null }, form({ voice: "Kore", monthlyCharacterLimit: "-1" }))).error).toMatch(/teto/);
    expect((await updateSpeechSettingsAction({ error: null }, form({ voice: "Kore", monthlyCharacterLimit: "abc" }))).error).toMatch(/teto/);
    expect(mocks.setSetting).not.toHaveBeenCalled();
  });
});

describe("ações do painel de áudios", () => {
  it("sem settings.manage não reenfileira nem chama o worker", async () => {
    mocks.authorized = false;
    expect((await retryFailedSpeechAction({ error: null, notice: null }, form({ scope: "s" }))).error).toBe("Sem permissão.");
    expect((await requestSpeechWorkerRunAction()).error).toBe("Sem permissão.");
    expect(mocks.retryFailedSpeech).not.toHaveBeenCalled();
    expect(mocks.requestSpeechWorkerRun).not.toHaveBeenCalled();
  });

  it("tentar de novo usa o scope do formulário; vazio = todos", async () => {
    const state = await retryFailedSpeechAction({ error: null, notice: null }, form({ scope: "novels.work:1" }));
    expect(mocks.retryFailedSpeech).toHaveBeenCalledWith({ scope: "novels.work:1" });
    expect(state).toEqual({ error: null, notice: "2 textos voltaram para a fila." });
    await retryFailedSpeechAction({ error: null, notice: null }, form({}));
    expect(mocks.retryFailedSpeech).toHaveBeenLastCalledWith({ scope: null });
  });

  it("gerar de novo exige settings.manage e usa o scope do formulário", async () => {
    mocks.authorized = false;
    expect((await regenerateSpeechAction({ error: null, notice: null }, form({ scope: "s" }))).error).toBe("Sem permissão.");
    expect(mocks.regenerateSpeech).not.toHaveBeenCalled();
    mocks.authorized = true;
    const state = await regenerateSpeechAction({ error: null, notice: null }, form({ scope: "novels.work:1" }));
    expect(mocks.regenerateSpeech).toHaveBeenCalledWith({ scope: "novels.work:1" });
    expect(state).toEqual({ error: null, notice: "3 faixas voltaram para a fila." });
  });

  it("gerar agora chama o worker", async () => {
    expect((await requestSpeechWorkerRunAction()).error).toBeNull();
    expect(mocks.requestSpeechWorkerRun).toHaveBeenCalledOnce();
  });
});
