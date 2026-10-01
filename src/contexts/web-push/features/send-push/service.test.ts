import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
vi.mock("web-push", () => ({ default: { sendNotification: (...a: unknown[]) => sendNotification(...a), setVapidDetails: (...a: unknown[]) => setVapidDetails(...a) } }));

const listByActor = vi.fn();
const deleteById = vi.fn();
vi.mock("../../shared/store", () => ({
  listByActor: (...a: unknown[]) => listByActor(...a),
  deleteById: (...a: unknown[]) => deleteById(...a),
}));

function sub(id: string) {
  return { id, endpoint: `https://fcm.googleapis.com/fcm/send/${id}`, p256dh: "p", auth: "a" };
}

describe("sendPushToActor", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
    sendNotification.mockReset().mockResolvedValue(undefined);
    listByActor.mockReset();
    deleteById.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("envia pra cada device e não poda nada quando tudo dá certo", async () => {
    listByActor.mockResolvedValue([sub("a"), sub("b")]);
    const { sendPushToActor } = await import("./service");
    const result = await sendPushToActor("actor-1", { title: "Oi", body: "corpo" });

    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: true, data: { sent: 2, pruned: 0 } });
    expect(deleteById).toHaveBeenCalledWith([]);
  });

  it("nunca chama endpoint fora da allowlist e o poda", async () => {
    listByActor.mockResolvedValue([sub("ok"), { id: "ssrf", endpoint: "http://169.254.169.254/latest/meta-data", p256dh: "p", auth: "a" }]);
    const { sendPushToActor } = await import("./service");
    const result = await sendPushToActor("actor-1", { title: "t", body: "b" });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, data: { sent: 1, pruned: 1 } });
    expect(deleteById).toHaveBeenCalledWith(["ssrf"]);
  });

  it("poda inscrições mortas (404/410) e mantém as vivas", async () => {
    listByActor.mockResolvedValue([sub("viva"), sub("morta")]);
    sendNotification.mockImplementation((s: { endpoint: string }) => {
      if (s.endpoint.endsWith("morta")) return Promise.reject(Object.assign(new Error("gone"), { statusCode: 410 }));
      return Promise.resolve();
    });

    const { sendPushToActor } = await import("./service");
    const result = await sendPushToActor("actor-1", { title: "t", body: "b" });

    expect(result).toEqual({ success: true, data: { sent: 1, pruned: 1 } });
    expect(deleteById).toHaveBeenCalledWith(["morta"]);
  });

  it("é no-op quando não há chaves VAPID no ambiente", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    const { sendPushToActor } = await import("./service");
    const result = await sendPushToActor("actor-1", { title: "t", body: "b" });

    expect(result).toEqual({ success: true, data: { sent: 0, pruned: 0 } });
    expect(listByActor).not.toHaveBeenCalled();
  });
});
