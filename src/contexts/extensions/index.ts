export { getExtensionStateHandler as getExtensionState } from "./features/get-extension-state/handler";
export { listExtensionStatesHandler as listExtensionStates } from "./features/list-extension-states/handler";
export { setExtensionEnabledHandler as setExtensionEnabled } from "./features/set-extension-enabled/handler";
export { setExtensionInstalledHandler as setExtensionInstalled } from "./features/set-extension-installed/handler";

export type { ExtensionKind, ExtensionStateRecord } from "./contracts/types";
export type { GetExtensionStateQuery, GetExtensionStateResult } from "./features/get-extension-state/types";
export type {
  ExtensionStateEntry,
  ListExtensionStatesQuery,
  ListExtensionStatesResult,
} from "./features/list-extension-states/types";
export type {
  SetExtensionEnabledInput,
  SetExtensionEnabledResult,
} from "./features/set-extension-enabled/types";
export type {
  SetExtensionInstalledInput,
  SetExtensionInstalledResult,
} from "./features/set-extension-installed/types";
