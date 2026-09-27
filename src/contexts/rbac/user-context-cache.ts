import { bumpCacheVersion, readCacheVersion } from "@/infrastructure/cache/cache-version";
import type { UserRbacContext } from "./contracts/types";

const TTL_MS = 5 * 60 * 1000;
// De quanto em quanto tempo uma instância confere se outra mudou papéis/permissions. É o atraso
// máximo pra uma remoção de papel valer nas OUTRAS instâncias (na que fez a mudança é imediato).
const VERSION_CHECK_INTERVAL_MS = 5 * 1000;
const VERSION_NAMESPACE = "rbac.user-context";

type CacheEntry = { value: UserRbacContext; expiresAt: number };

type CacheState = { entries: Map<string, CacheEntry>; version: number | null; checkedAt: number };

// Em globalThis, não em variável de módulo: cada camada de bundle do Next (Server Action, Route
// Handler, Server Component) pode avaliar sua própria cópia deste módulo — mesmo motivo de
// infrastructure/cache/memory-cache.ts. Com Map de módulo, invalidar numa camada não limpava a
// cópia das outras.
type CacheGlobal = typeof globalThis & { __venoreRbacUserContextCache?: CacheState };

function state(): CacheState {
  const globalWithCache = globalThis as CacheGlobal;
  if (!globalWithCache.__venoreRbacUserContextCache) {
    globalWithCache.__venoreRbacUserContextCache = { entries: new Map(), version: null, checkedAt: 0 };
  }
  return globalWithCache.__venoreRbacUserContextCache;
}

// Chamado antes de ler o cache (get-user-context/service.ts). Consulta a versão no banco no
// máximo a cada VERSION_CHECK_INTERVAL_MS; se outra instância incrementou, descarta tudo.
export async function syncUserContextCacheVersion(): Promise<void> {
  const current = state();
  if (Date.now() - current.checkedAt < VERSION_CHECK_INTERVAL_MS) return;

  let version: number | null;
  try {
    version = await readCacheVersion(VERSION_NAMESPACE);
  } catch {
    // Sem como confirmar que o cache está fresco: descarta (a leitura de papéis logo em seguida
    // vai ao banco de qualquer forma).
    version = null;
  }
  if (version === null || version !== current.version) {
    current.entries.clear();
  }
  current.version = version;
  current.checkedAt = Date.now();
}

export function getCachedUserContext(userId: string): UserRbacContext | null {
  const entries = state().entries;
  const entry = entries.get(userId);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    entries.delete(userId);
    return null;
  }

  return entry.value;
}

export function setCachedUserContext(userId: string, value: UserRbacContext): void {
  state().entries.set(userId, { value, expiresAt: Date.now() + TTL_MS });
}

// Local na hora; nas outras instâncias em até VERSION_CHECK_INTERVAL_MS (via versão no banco).
// Aceita lista pra mudança de papel que afeta vários usuários: uma escrita no banco, não uma por
// usuário.
export async function invalidateUserContext(userIds: string | string[]): Promise<void> {
  const ids = typeof userIds === "string" ? [userIds] : userIds;
  if (ids.length === 0) return;
  const current = state();
  for (const id of ids) current.entries.delete(id);
  try {
    await bumpCacheVersion(VERSION_NAMESPACE);
  } catch {
    // Falha ao publicar a invalidação: as outras instâncias só pegam a mudança pelo TTL. Não
    // derruba a operação que já gravou o dado.
  }
}
