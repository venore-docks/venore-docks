import type { OperationResult } from "@/shared/types";

export type ScheduledJob = {
  key: string;
  intervalMinutes: number;
  run: () => Promise<OperationResult<unknown>>;
};

export type ScheduledJobReport = { key: string; status: "success" | "failure" | "skipped"; error?: string };
