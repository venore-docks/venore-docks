// @venore/theme-sdk — superfície que um pacote de tema (@venore/theme-*) consome do core.
// Hoje é um alias de tsconfig/vitest pra este diretório (igual @venore/plugin-sdk -> src/sdk),
// NÃO um pacote publicado. Um tema importa daqui em vez de `@/…` porque o `@/` do host não
// resolve de dentro de node_modules.
//
// Este entry (raiz) é FOLHA: só o contrato de slot. UI (cn, primitivos, NavIcon, Sitemap) fica
// em "@venore/theme-sdk/ui" pra não arrastar client components pra quem só quer os tipos.
export * from "@/contexts/themes/contracts/types";
export * from "@/contexts/themes/contracts/v8";
export {
  CURRENT_THEME_CONTRACT_VERSION,
  SUPPORTED_THEME_CONTRACT_RANGE,
  LEGACY_THEME_CONTRACT_RANGE,
  V8_THEME_CONTRACT_RANGE,
} from "@/contexts/themes/contracts/contract-version";
export { defineTheme } from "./define";
