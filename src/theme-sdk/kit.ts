// @venore/theme-sdk/kit — componentes do kit (o venore-slime de hoje) que um tema v8 usa como
// `Default` ou compõe. Server-safe: componentes client daqui são referências, não executam aqui.
// Hooks/stores/boundary client ficam em "@venore/theme-sdk/kit-client".
export * from "./kit/exports/regions";
export * from "./kit/exports/templates";
export { t, KIT_STRINGS_PT_BR } from "./kit/i18n/t";
export { KIT_MESSAGES_PT_BR } from "./kit/i18n/messages/pt-BR";
export { KIT_MESSAGES, KIT_BASE_LOCALE, localeFallbackChain, mergeLocaleStrings } from "./kit/i18n/catalogs";
