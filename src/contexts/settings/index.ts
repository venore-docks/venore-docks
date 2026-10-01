export { getSettingHandler as getSetting } from "./features/get-setting/handler";
export { setSettingHandler as setSetting } from "./features/set-setting/handler";
export { registerDefaultSettingHandler as registerDefaultSetting } from "./features/register-default-setting/handler";
// Só pra quem apaga linhas de settings por fora (platform/plugin-engine/uninstall-plugin.ts).
export { forgetSettingsByPrefix } from "./settings-cache-version";
export { settingsAdminNavigationItems } from "./admin-navigation";
export { settingsBreadcrumbSegments } from "./breadcrumbs";

export type { SettingRecord, CoreSettingDefaultKey } from "./contracts/types";
export { CORE_SETTING_DEFAULTS } from "./contracts/types";
export type { GetSettingResult } from "./features/get-setting/types";
export type { SetSettingInput, SetSettingResult } from "./features/set-setting/types";
export type { RegisterDefaultSettingInput, RegisterDefaultSettingResult } from "./features/register-default-setting/types";
