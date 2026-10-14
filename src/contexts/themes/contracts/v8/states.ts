import type { ComponentType } from "react";
import type { ThemePageStateKey } from "./enums";
import type { ThemeStrings } from "./i18n";
import type { RegionCommon } from "./regions";

// Estados de página (spec §2.7 / §7.9). "error" é client-only (ThemeClientDefinition).
export type PageStateProps = RegionCommon & {
  title: string;
  message: string | null;
  action: { href: string; label: string } | null;
};
export type ThemeServerStateKey = Exclude<ThemePageStateKey, "error">;
export type ThemeStates = Partial<Record<ThemeServerStateKey, ComponentType<PageStateProps>>>;
export type ClientErrorStateProps = { error: Error & { digest?: string }; reset: () => void; strings: ThemeStrings };
// Entry "<pkg>/theme-client" ('use client').
export type ThemeClientDefinition = { ErrorState?: ComponentType<ClientErrorStateProps> };
