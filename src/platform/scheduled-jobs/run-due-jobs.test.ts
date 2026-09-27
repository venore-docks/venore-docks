import { beforeEach, describe, expect, it, vi } from "vitest";

const claimJob = vi.fn();
const finishJob = vi.fn();
vi.mock("./store", () => ({
  claimJob: (...args: unknown[]) => claimJob(...args),
  finishJob: (...args: unknown[]) => finishJob(...args),
}));

const coreRun = vi.fn();
vi.mock("./core-jobs", () => ({
  CORE_SCHEDULED_JOBS: [{ key: "core.job", intervalMinutes: 1, run: () => coreRun() }],
}));

const pluginRun = vi.fn();
vi.mock("@/plugins/contributions", () => ({
  PLUGIN_CONTRIBUTIONS: {
    agenda: { scheduledJobs: [{ key: "reminders", intervalMinutes: 60, run: () => pluginRun() }] },
    inactive: { scheduledJobs: [{ key: "never", intervalMinutes: 1, run: vi.fn() }] },
  },
}));

vi.mock("@/platform/plugin-engine/get-active-plugin-keys", () => ({
  getActivePluginKeys: async () => new Set(["agenda"]),
}));

vi.mock("@/observability", () => ({ beginOperation: vi.fn(() => ({})), endOperation: vi.fn() }));

describe("runDueJobs", () => {
  beforeEach(() => {
    claimJob.mockReset().mockResolvedValue(true);
    finishJob.mockReset().mockResolvedValue(undefined);
    coreRun.mockReset().mockResolvedValue({ success: true, data: 1 });
    pluginRun.mockReset().mockResolvedValue({ success: true, data: null });
  });

  it("runs core jobs and jobs of ACTIVE plugins, prefixing plugin keys", async () => {
    const { runDueJobs } = await import("./run-due-jobs");
    const reports = await runDueJobs();

    expect(reports.map((report) => report.key)).toEqual(["core.job", "agenda.reminders"]);
    expect(claimJob).toHaveBeenCalledWith("agenda.reminders", 60 * 60 * 1000 - 5_000, expect.any(Number));
    expect(finishJob).toHaveBeenCalledWith("core.job", "success", null);
  });

  it("skips a job another instance holds and isolates failures", async () => {
    claimJob.mockImplementation(async (key: string) => key !== "core.job");
    pluginRun.mockRejectedValue(new Error("boom"));

    const { runDueJobs } = await import("./run-due-jobs");
    const reports = await runDueJobs();

    expect(reports).toEqual([
      { key: "core.job", status: "skipped" },
      { key: "agenda.reminders", status: "failure", error: "boom" },
    ]);
    expect(finishJob).toHaveBeenCalledWith("agenda.reminders", "failure", "boom");
  });
});
