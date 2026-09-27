import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sealSecret } from "../../../shared/secret-box";
import { currentTotpStep, generateTotpSecret, totpAt } from "../../../shared/totp";
import { hashRecoveryCode } from "../shared/recovery-codes";

const findMfaRow = vi.fn();
const advanceLastStep = vi.fn(async () => true);
const consumeRecoveryCode = vi.fn(async () => true);
vi.mock("../shared/store", () => ({
  findMfaRow: (...a: unknown[]) => findMfaRow(...a),
  advanceLastStep: (...a: unknown[]) => advanceLastStep(...(a as [])),
  consumeRecoveryCode: (...a: unknown[]) => consumeRecoveryCode(...(a as [])),
}));

describe("verifyMfaCode", () => {
  const secret = generateTotpSecret();
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
    findMfaRow.mockResolvedValue({ mfaSecret: sealSecret(secret), mfaLastStep: null });
    advanceLastStep.mockClear();
    consumeRecoveryCode.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("accepts the current app code once (the step is recorded atomically)", async () => {
    const { verifyMfaCode } = await import("./service");
    const step = currentTotpStep();
    expect(await verifyMfaCode("u1", totpAt(secret, step))).toBe(true);
    expect(advanceLastStep).toHaveBeenCalledWith("u1", step);
    advanceLastStep.mockResolvedValueOnce(false);
    expect(await verifyMfaCode("u1", totpAt(secret, step))).toBe(false);
  });

  it("falls back to a single-use recovery code", async () => {
    const { verifyMfaCode } = await import("./service");
    expect(await verifyMfaCode("u1", "ABCD-efgh")).toBe(true);
    expect(consumeRecoveryCode).toHaveBeenCalledWith("u1", hashRecoveryCode("abcdefgh"));
  });

  it("rejects anything when the account has no second factor", async () => {
    findMfaRow.mockResolvedValue({ mfaSecret: null });
    const { verifyMfaCode } = await import("./service");
    expect(await verifyMfaCode("u1", "123456")).toBe(false);
  });
});
