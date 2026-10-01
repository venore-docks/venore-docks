import type { PublishedThemeConfig } from "../../../contracts/v8/config-document";

// Último documento publicado lido com sucesso NESTE processo (spec §4.1, degrau "last-known-good").
// Memória de processo, não banco — o único "dado" deste use case além do settings (lido via
// barrel no service).
type LastKnownGoodGlobal = typeof globalThis & { __venoreThemeConfigLastKnownGood?: PublishedThemeConfig };

export function readLastKnownGood(): PublishedThemeConfig | null {
  return (globalThis as LastKnownGoodGlobal).__venoreThemeConfigLastKnownGood ?? null;
}

export function writeLastKnownGood(config: PublishedThemeConfig): void {
  (globalThis as LastKnownGoodGlobal).__venoreThemeConfigLastKnownGood = config;
}

export function clearLastKnownGood(): void {
  delete (globalThis as LastKnownGoodGlobal).__venoreThemeConfigLastKnownGood;
}
