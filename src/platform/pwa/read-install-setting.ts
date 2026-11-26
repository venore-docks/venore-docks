import { cache } from "react";
import { getSetting } from "@/contexts/settings";
import { parsePwaInstallSetting, PWA_INSTALL_DEFAULTS, PWA_INSTALL_SETTING_KEY, type PwaInstallSetting } from "./install-policy";

export const readPwaInstallSetting = cache(async (): Promise<PwaInstallSetting> => {
  const result = await getSetting({ key: PWA_INSTALL_SETTING_KEY });
  if (!result.success || !result.data) return { ...PWA_INSTALL_DEFAULTS };
  return parsePwaInstallSetting(result.data.value);
});
