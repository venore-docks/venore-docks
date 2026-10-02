import type { FontId, FontRole } from "./fonts";
import type { ThemeText } from "./i18n";

// Opções declaradas pelo tema (spec §2.3). Valor de design continua no theme.css do tema:
// select/boolean viram atributo `data-opt-<key>`, range/color viram var `--opt-<key>` validada.
// Chaves reservadas (não declaráveis): layout, mobile-nav, contextual-bar.
export const THEME_OPTION_KEY_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
export const RESERVED_THEME_OPTION_KEYS: readonly string[] = ["layout", "mobile-nav", "contextual-bar"];

type OptionBase = {
  key: string;
  label: ThemeText;
  description?: ThemeText;
  group?: string;
  when?: { key: string; equals: string | boolean };
};
export type ThemeOptionField =
  | (OptionBase & { type: "boolean"; default: boolean })
  | (OptionBase & { type: "select"; default: string; choices: readonly { value: string; label: ThemeText }[] })
  | (OptionBase & {
      type: "range";
      default: number;
      min: number;
      max: number;
      step: number;
      unit: "" | "rem" | "px" | "%" | "ms" | "deg";
    })
  | (OptionBase & { type: "color"; default: string })
  | (OptionBase & { type: "font"; role: FontRole; default?: FontId })
  | (OptionBase & { type: "text"; default: string; maxLength: number })
  | (OptionBase & { type: "media"; accept: "image" });
export type ThemeOptionType = ThemeOptionField["type"];
export type ThemeOptionValue = string | number | boolean | null;
export type ResolvedThemeOptions = {
  values: Readonly<Record<string, ThemeOptionValue>>;
  media: Readonly<Record<string, { url: string; alt: string } | null>>;
  ignored: readonly { key: string; reason: "unknown" | "invalid" | "removed" }[];
};
