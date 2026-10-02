import type { ReactNode } from "react";
import type { HeaderUserInfo } from "../types";

// Outlets (spec §2.8 / §7.4): pontos nomeados onde plugins injetam JSX dentro das regiões do tema.
export const THEME_OUTLET_NAMES = [
  "header.start",
  "header.end",
  "rail.top",
  "rail.bottom",
  "content.before",
  "content.after",
  "contextual.top",
  "contextual.bottom",
  "footer.top",
  "footer.bottom",
  "userMenu.items",
  "home.showcase",
  "entry.after-content",
] as const;
export type ThemeOutletName = (typeof THEME_OUTLET_NAMES)[number];
export type ThemeOutletNodes = Partial<Record<ThemeOutletName, ReactNode>>;
// Outlets que um Shell 7.x consegue receber (o adapter só embrulha o conteúdo).
export const LEGACY_THEME_OUTLETS: readonly ThemeOutletName[] = ["content.before", "content.after"];
export type OutletRenderContext = {
  pathname: string;
  area: "public" | "admin";
  user: HeaderUserInfo | null;
  canAccessAdmin: boolean;
  themeKey: string;
  locale: string;
};
