import { sql } from "drizzle-orm";
import { invalidateExtensionStateCaches, listExtensionStates } from "@/contexts/extensions";
import { authorizeActor } from "@/contexts/rbac";
import { invalidateCache } from "@/infrastructure/cache/memory-cache";
// Import direto do client de infra (não de um store de context): a operação é atômica por
// natureza — DROP SCHEMA do plugin + limpeza de settings/rbac/extension_state numa transação só —
// e não existe um context "dono" de "apagar todo o rastro de um plugin". Mesma natureza de
// run-plugin-migrations.ts, e o boundary de lint não restringe platform/ -> infrastructure/.
// NUNCA abrir um Pool próprio aqui (AGENTS.md seção 2) — o singleton já existe.
import { db } from "@/infrastructure/database/client";
import { beginOperation, endOperation, recordAuditEvent } from "@/observability";
import type { OperationResult } from "@/shared/types";
import { PLUGIN_REGISTRY } from "@/plugins/registry";
import { findEnabledDependents } from "./find-dependent-plugins";
import { PLUGIN_ENGINE_REPORT_CACHE_KEY, registerPlugins } from "./register-plugins";
import { resolvePluginDataSchema } from "./resolve-plugin-data-schema";
import { resolveMigrationsSchema } from "./run-plugin-migrations";

export type UninstallPluginInput = {
  pluginKey: string;
  // true  = "modo B destrutivo": além de desregistrar, APAGA o rastro do plugin no banco
  //         (schema de dados + schema de migrations + settings + concessões de permission).
  // false = "modo B não-destrutivo": só desregistra (installed_at nulo). Schema, dados e o
  //         histórico de migrations continuam intactos — reinstalar roda só as migrations novas.
  purgeData: boolean;
};

// Desinstalação "modo B" (docs/issues.md — "Plugins e Temas"): diferente de desativar
// (togglePluginEnabled(false), que não apaga nada e é reversível), isto tira o plugin do ar
// (installed_at nulo). Com purgeData=true APAGA de vez o rastro do plugin no banco — destrutivo
// e irreversível, a UI exige confirmação digitando a key. Com purgeData=false o banco fica
// intacto: uma reinstalação futura aplica só as migrations pendentes, sem zerar dados.
//
// Composição do ponto de wiring (docs/venore-docks.md — regra 12): conhecer PLUGIN_REGISTRY,
// derivar os schemas do plugin e orquestrar a transação é papel de platform/. authorizeActor
// mora aqui, não num handler de context (mesmo padrão de seed-plugin.ts). Gateado por
// platform.extensions.manage — a mesma permission de instalar/desativar.
export async function uninstallPlugin(command: UninstallPluginInput): Promise<OperationResult<void>> {
  const authz = await authorizeActor("platform.extensions.manage");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }
  return performPluginUninstall({
    pluginKey: command.pluginKey,
    purgeData: command.purgeData,
    actorId: authz.actorId,
  });
}

// Núcleo sem authorizeActor — separado de uninstallPlugin pelo mesmo motivo que os service.ts dos
// contexts são separados dos handlers: os testes de integração exercitam esta função direto com um
// actorId semeado, sem sessão HTTP (AGENTS.md — "Testes de integração": ninguém chama authorizeActor
// nos *.integration.test.ts). NÃO exportar pelo barrel de nada; só uninstallPlugin é a porta pública.
export async function performPluginUninstall(command: {
  pluginKey: string;
  purgeData: boolean;
  actorId: string;
}): Promise<OperationResult<void>> {
  const { pluginKey, purgeData, actorId } = command;

  const manifest = PLUGIN_REGISTRY.find((entry) => entry.key === pluginKey);
  if (!manifest) {
    return {
      success: false,
      error: {
        code: "plugin-engine.uninstall.unknown_plugin",
        message: `Plugin "${pluginKey}" não está no registro (src/plugins/registry.ts).`,
      },
    };
  }

  const states = await listExtensionStates({ kind: "plugin" });
  const installed = states.success && Boolean(states.data[pluginKey]?.installed);
  if (!installed) {
    return {
      success: false,
      error: {
        code: "plugin-engine.uninstall.not_installed",
        message: `Plugin "${pluginKey}" não está instalado — nada a desinstalar.`,
      },
    };
  }

  // Mesma invariante de togglePluginEnabled(false): não dá pra remover um plugin do qual outro
  // plugin habilitado depende. A mensagem diz QUEM depende (docs/venore-docks.md).
  const report = await registerPlugins();
  const dependents = findEnabledDependents(pluginKey, report);
  if (dependents.length > 0) {
    const names = dependents.map((dependent) => dependent.name).join(", ");
    return {
      success: false,
      error: {
        code: "plugin-engine.uninstall.blocked_by_dependents",
        message: `Não é possível desinstalar "${pluginKey}": ${names} depende${dependents.length > 1 ? "m" : ""} dele.`,
      },
    };
  }

  const dataSchema = manifest.migrationsPath ? resolvePluginDataSchema(pluginKey) : null;
  const migrationsSchema = manifest.migrationsPath
    ? resolveMigrationsSchema(pluginKey, manifest.migrationsSchema)
    : null;
  const namespacePrefix = `${pluginKey}.%`;

  const handle = beginOperation({
    useCase: "platform.plugin-engine.uninstall-plugin",
    actor: { id: actorId, type: "user" },
    kind: "write",
  });

  try {
    // Uma transação só (docs/issues.md — pedido literal): ou todo o rastro some, ou nada muda.
    // DDL (DROP SCHEMA) é transacional no Postgres, então um erro no meio faz rollback completo.
    // Sem purgeData a transação só faz o UPDATE em extension_state — o banco do plugin fica igual.
    const purged = await db.transaction(async (tx) => {
      let settingsDeleted = 0;
      let permissionsDeleted = 0;

      if (purgeData) {
        if (dataSchema) {
          await tx.execute(sql.raw(`DROP SCHEMA IF EXISTS "${dataSchema}" CASCADE`));
        }
        if (migrationsSchema) {
          await tx.execute(sql.raw(`DROP SCHEMA IF EXISTS "${migrationsSchema}" CASCADE`));
        }

        const settingsResult = await tx.execute(
          sql`delete from settings.settings where key like ${namespacePrefix}`,
        );
        const permissionsResult = await tx.execute(
          sql`delete from rbac.role_permissions where permission_key like ${namespacePrefix}`,
        );
        settingsDeleted = settingsResult.rowCount ?? 0;
        permissionsDeleted = permissionsResult.rowCount ?? 0;
      }

      // Sempre: extension_state volta pro estado "disponível" (installed_at nulo) e enabled=true,
      // pra uma reinstalação futura começar do zero (não herdar um enabled=false de antes). Com
      // purgeData=false, o schema de migrations sobrou — reinstalar aplica só as pendentes.
      await tx.execute(sql`
        update extensions.extension_state
        set installed_at = null, enabled = true, updated_by_user_id = ${actorId}, updated_at = now()
        where kind = 'plugin' and key = ${pluginKey}
      `);

      return { settingsDeleted, permissionsDeleted };
    });

    // Quem escreve invalida (docs/venore-docks.md — Cache). O UPDATE em extension_state foi por
    // fora dos handlers de contexts/extensions (pra caber na transação), então os caches de
    // leitura daquele context são invalidados aqui explicitamente.
    invalidateExtensionStateCaches("plugin", pluginKey);
    invalidateCache(PLUGIN_ENGINE_REPORT_CACHE_KEY);

    const summary = purgeData
      ? `Plugin "${pluginKey}" desinstalado (limpeza de banco): ` +
        `${dataSchema ? `schema "${dataSchema}" removido, ` : "sem schema próprio, "}` +
        `${purged.settingsDeleted} configuração(ões) e ${purged.permissionsDeleted} concessão(ões) de permission apagadas.`
      : `Plugin "${pluginKey}" desinstalado (banco preservado): schema, dados e histórico de ` +
        `migrations mantidos — reinstalar aplica só as migrations pendentes.`;

    endOperation(handle, { success: true, summary });
    await recordAuditEvent({
      action: "plugin-engine.uninstall-plugin",
      actor: { id: actorId, type: "user" },
      outcome: "success",
      summary,
      detail: { pluginKey, purgeData, dataSchema, migrationsSchema, ...purged },
    });

    return { success: true, data: undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failure = {
      code: "plugin-engine.uninstall.failed",
      message: `Falha ao desinstalar "${pluginKey}": ${message}`,
    };
    endOperation(handle, { success: false, error: failure });
    await recordAuditEvent({
      action: "plugin-engine.uninstall-plugin",
      actor: { id: actorId, type: "user" },
      outcome: "failure",
      summary: `Falha ao desinstalar plugin "${pluginKey}": ${message}`,
      detail: { pluginKey },
    });
    return { success: false, error: failure };
  }
}
