import { getSetting, setSetting } from "@/contexts/settings";
import { beginOperation, endOperation, recordAuditEvent } from "@/observability";
import { buildPublishedSettingEntries, type SettingEntry } from "../shared/published-settings";
import { toThemeConfigRevisionView } from "../shared/revision-view";
import { publishDraftTransaction, revertPublishTransaction } from "./store";
import type { PublishThemeDraftCommand, PublishThemeDraftResult } from "./types";

// Chave que não existia volta como `false` no revert (a coluna é jsonb NOT NULL): todo leitor
// trata valor que não é string/objeto como ausente — theme.config cai na síntese legada,
// theme.active/activePaletteId no padrão.
const ABSENT_SETTING_VALUE = false;

type SettingsWriteOutcome = { success: true } | { success: false; message: string };

async function readCurrentValue(key: string): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    const result = await getSetting({ key, skipCache: true });
    return result.success ? { ok: true, value: result.data ? result.data.value : ABSENT_SETTING_VALUE } : { ok: false };
  } catch {
    return { ok: false };
  }
}

async function writeSetting(entry: SettingEntry): Promise<SettingsWriteOutcome> {
  try {
    const result = await setSetting({ key: entry.key, value: entry.value });
    return result.success ? { success: true } : { success: false, message: result.error.message };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : String(error) };
  }
}

// Passo 3 (spec §4.3): `theme.config` + chaves legadas via barrel do settings. Antes de gravar,
// guarda o valor atual de cada chave; se uma gravação falhar, as já gravadas voltam ao valor
// anterior — melhor esforço, pra que nem a config nova nem as legadas fiquem mais novas que o
// histórico depois do revert.
async function writePublishedSettings(entries: readonly SettingEntry[]): Promise<SettingsWriteOutcome> {
  const previous = new Map<string, unknown>();
  for (const entry of entries) {
    const current = await readCurrentValue(entry.key);
    if (!current.ok) return { success: false, message: `Não foi possível ler a configuração "${entry.key}".` };
    previous.set(entry.key, current.value);
  }

  const written: SettingEntry[] = [];
  for (const entry of entries) {
    const outcome = await writeSetting(entry);
    if (!outcome.success) {
      for (const done of written.reverse()) {
        await writeSetting({ key: done.key, value: previous.get(done.key) ?? ABSENT_SETTING_VALUE });
      }
      return outcome;
    }
    written.push(entry);
  }
  return { success: true };
}

// Publica o rascunho (spec §4.3): 1 validação contra o registro já feita pelo composer de
// platform (validate-theme-config.ts) → 2 transação do histórico → 3 settings (revert se falhar)
// → 4 auditoria. revalidatePath fica com a action. Rollback chama esta mesma função.
export async function publishThemeDraft(command: PublishThemeDraftCommand): Promise<PublishThemeDraftResult> {
  const audit = command.audit ?? { action: "themes.config.publish" as const };
  const actor = { id: command.actorId, type: "user" };
  const handle = beginOperation({ useCase: "themes.theme-config.publish-draft", actor, kind: "write" });

  const transaction = await publishDraftTransaction({ actorId: command.actorId, now: new Date() });
  if (!transaction.success) {
    endOperation(handle, { success: false, error: transaction.error });
    return transaction;
  }
  if (!transaction.data) {
    const error = { code: "themes.config.no_draft", message: "Não há rascunho de aparência para publicar." };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  const { revision: row, previousPublishedId, prunedIds } = transaction.data;
  const view = toThemeConfigRevisionView(row);
  const failPublish = async (message: string) => {
    await revertPublishTransaction({ revisionId: row.id, previousPublishedId });
    const error = { code: "themes.config.publish_failed", message: `A publicação foi desfeita: ${message}` };
    endOperation(handle, { success: false, error });
    return { success: false as const, error };
  };
  if (!view || !view.publishedAt) return failPublish("o rascunho não é um documento de tema válido.");

  const written = await writePublishedSettings(buildPublishedSettingEntries(view.config, view.id, view.publishedAt));
  if (!written.success) return failPublish(written.message);

  try {
    await recordAuditEvent({
      action: audit.action,
      actor,
      outcome: "success",
      summary:
        audit.action === "themes.config.rollback"
          ? `Aparência restaurada a partir de uma revisão anterior (tema ${view.config.themeKey}).`
          : `Aparência publicada (tema ${view.config.themeKey}).`,
      detail: { revisionId: view.id, themeKey: view.config.themeKey, previousRevisionId: previousPublishedId, ...audit.detail },
    });
  } catch {
    // A publicação já valeu (histórico + settings); auditoria que falha não a desfaz — o log
    // operacional abaixo ainda registra a operação.
  }

  endOperation(handle, {
    success: true,
    summary: `Aparência publicada (tema ${view.config.themeKey}).`,
    detail: { revisionId: view.id, prunedRevisions: prunedIds.length },
  });
  return { success: true, data: view };
}
