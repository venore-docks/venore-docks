import type { OperationResult } from "@/shared/types";
import type { ThemeConfigRevisionView } from "../../../contracts/v8/config-document";

export type ThemeConfigAuditAction = "themes.config.publish" | "themes.config.rollback";
export type PublishThemeDraftCommand = {
  actorId: string;
  // Rollback reaproveita os passos de publicação com a própria ação de auditoria.
  audit?: { action: ThemeConfigAuditAction; detail?: Record<string, unknown> };
};
export type PublishThemeDraftResult = OperationResult<ThemeConfigRevisionView>;
