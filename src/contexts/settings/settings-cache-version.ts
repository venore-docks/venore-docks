import { bumpCacheVersion, readCacheVersion } from "../../infrastructure/cache/cache-version";
import { invalidateCacheByPrefix } from "../../infrastructure/cache/memory-cache";
import { forgetConfirmedDefaultSettings } from "./features/register-default-setting/service";

// O cache de settings (get-setting/service.ts, prefixo `settings:`) é POR PROCESSO: o
// invalidateCache do setSetting só limpava a instância que atendeu o save, e as demais serviam o
// valor antigo até o TTL (5 min) — sintoma: "salvei em /admin e o site ainda mostra o anterior".
// Mesmo mecanismo de rbac/user-context-cache.ts: quem escreve incrementa um contador em
// platform.cache_versions, quem lê confere esse contador no máximo a cada
// VERSION_CHECK_INTERVAL_MS e descarta o cache inteiro se ele mudou.
const VERSION_NAMESPACE = "settings";
const VERSION_CHECK_INTERVAL_MS = 5 * 1000;
export const SETTINGS_CACHE_PREFIX = "settings:";

type VersionState = { version: number | null; checkedAt: number };

// globalThis pelo mesmo motivo de memory-cache.ts: cada camada de bundle do Next pode avaliar
// sua própria cópia deste módulo.
type VersionGlobal = typeof globalThis & { __venoreSettingsCacheVersion?: VersionState };

function state(): VersionState {
  const globalWithState = globalThis as VersionGlobal;
  if (!globalWithState.__venoreSettingsCacheVersion) {
    globalWithState.__venoreSettingsCacheVersion = { version: null, checkedAt: 0 };
  }
  return globalWithState.__venoreSettingsCacheVersion;
}

// Checagem em voo compartilhada: um render dispara várias leituras de setting em paralelo
// (Promise.all de marca/header/nav/locale/manutenção...) e, com o intervalo vencido, cada uma
// fazia o seu SELECT em cache_versions. Agora a primeira faz e as demais aguardam a mesma.
let inFlight: Promise<void> | null = null;

export async function syncSettingsCacheVersion(): Promise<void> {
  const current = state();
  if (Date.now() - current.checkedAt < VERSION_CHECK_INTERVAL_MS) return;
  if (!inFlight) {
    inFlight = checkSettingsCacheVersion(current).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function checkSettingsCacheVersion(current: VersionState): Promise<void> {
  let version: number | null;
  try {
    version = await readCacheVersion(VERSION_NAMESPACE);
  } catch {
    // Sem como confirmar que o cache está fresco: descarta (a leitura seguinte vai ao banco).
    version = null;
  }
  if (version === null || version !== current.version) {
    invalidateCacheByPrefix(SETTINGS_CACHE_PREFIX);
    // Outra instância pode ter apagado linhas (forgetSettingsByPrefix): volta a confirmar os
    // defaults — custa um INSERT ... ON CONFLICT DO NOTHING por chave, uma vez.
    forgetConfirmedDefaultSettings("");
  }
  current.version = version;
  current.checkedAt = Date.now();
}

// Chamado por quem grava (set-setting). Falha ao publicar não derruba a escrita já feita — as
// outras instâncias só pegam a mudança pelo TTL nesse caso.
export async function publishSettingsChange(): Promise<void> {
  try {
    await bumpCacheVersion(VERSION_NAMESPACE);
  } catch {
    // ver comentário acima
  }
}

// Pra quem apaga linhas de settings fora de set-setting (hoje: uninstall-plugin com purgeData,
// que faz DELETE direto na mesma transação do DROP SCHEMA). Limpa o cache local, a memória de
// defaults já registrados e avisa as outras instâncias.
export async function forgetSettingsByPrefix(prefix: string): Promise<void> {
  invalidateCacheByPrefix(`${SETTINGS_CACHE_PREFIX}${prefix}`);
  forgetConfirmedDefaultSettings(prefix);
  await publishSettingsChange();
}
