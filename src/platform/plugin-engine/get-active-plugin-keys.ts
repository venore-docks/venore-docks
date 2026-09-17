import { registerPlugins } from "./register-plugins";

// Conjunto das `key` de plugin com status "active" no relatório de registro (docs/venore-docks.md
// — regra 12). Mesmo dado que isPluginActive() checa por key, só que resolvido de uma vez pra
// quem precisa filtrar uma coleção inteira num único request: o palette de blocos do builder do
// CMS (listBlockDefinitions), o dispatch de render de bloco (components/page-builder/
// block-renderer.tsx) e o registro de breadcrumbs. registerPlugins() não cacheia (deploy é
// serverless — ver comentário em register-plugins.ts), então cada chamada lê fresco do banco.
export async function getActivePluginKeys(): Promise<Set<string>> {
  const report = await registerPlugins();
  return new Set(report.entries.filter((entry) => entry.status === "active").map((entry) => entry.key));
}
