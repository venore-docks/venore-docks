import { authorizeActor } from "@/contexts/rbac";
import { backfillAssetVariants } from "./service";
import type { BackfillAssetVariantsCommand, BackfillAssetVariantsResult } from "./types";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

export async function backfillAssetVariantsHandler(input: Partial<BackfillAssetVariantsCommand> = {}): Promise<BackfillAssetVariantsResult> {
  const authz = await authorizeActor("media.manage");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  const requested = Number.isInteger(input.limit) ? (input.limit as number) : DEFAULT_LIMIT;
  const limit = Math.min(Math.max(requested, 1), MAX_LIMIT);
  return backfillAssetVariants({ limit, actorId: authz.actorId });
}
