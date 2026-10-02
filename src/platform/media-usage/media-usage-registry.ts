import { findCmsMediaUsage } from "@/contexts/cms";
import { PLUGIN_CONTRIBUTIONS } from "@/plugins/contributions";
import { registerPlugins } from "../plugin-engine/register-plugins";
import { findBrandMediaUsage } from "../brand/find-brand-media-usage";
import { findThemeConfigMediaUsage } from "./find-theme-config-media-usage";
import type { MediaUsageProvider, MediaUsageReference } from "./types";

// Providers de contexts do core: sempre ativos, não têm estado enabled/disabled (mesmo raciocínio
// de admin-navigation-registry.ts pra itens de context vs. de plugin).
const CORE_PROVIDERS: Record<string, MediaUsageProvider> = {
  cms: findCmsMediaUsage,
  brand: findBrandMediaUsage,
  // Config do tema (spec v8 §7.6): assets (OG/ícone) e opções de mídia, publicado + rascunho.
  themes: findThemeConfigMediaUsage,
};

// Providers de plugin: vêm de src/plugins/*/contributions.ts (campo `mediaUsageResolver`),
// agregados em PLUGIN_CONTRIBUTIONS pelo codegen. Só entram na consulta se o plugin estiver ativo
// agora — resposta de propósito ao "consumidor que some": plugin desabilitado não registra
// provider, então suas referências somem da checagem de uso e da deleção. Escolha deliberada, não
// efeito colateral: reabilitar o plugin depois traz os dados dele (coverMediaId etc.) intactos de
// volta pra checagem. Nunca trava mídia pra sempre por causa de um plugin desligado, e nunca
// finge que a referência não existe de verdade.
export async function collectMediaUsage(mediaId: string): Promise<MediaUsageReference[]> {
  const pluginReport = await registerPlugins();
  const activePluginKeys = new Set(
    pluginReport.entries.filter((entry) => entry.status === "active").map((entry) => entry.key),
  );

  const providers: MediaUsageProvider[] = [
    ...Object.values(CORE_PROVIDERS),
    ...Object.entries(PLUGIN_CONTRIBUTIONS)
      .filter(([key]) => activePluginKeys.has(key))
      .map(([, contributions]) => contributions.mediaUsageResolver)
      .filter((resolver): resolver is MediaUsageProvider => Boolean(resolver)),
  ];

  const results = await Promise.all(providers.map((provider) => provider(mediaId)));
  return results.flat();
}
