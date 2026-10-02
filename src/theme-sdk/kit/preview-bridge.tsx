"use client";

import { useEffect } from "react";
import { THEME_COLOR_VALUE_PATTERN } from "@/contexts/themes/contracts/v8/config-document";

// PreviewBridge (spec §7.2): montado só quando há override de preview de rascunho ativo. O
// /admin/themes/customize (mesma origem, pai do iframe) manda por postMessage as edições de token e
// de opção ainda não salvas; o bridge VALIDA cada valor (nome kebab-case, cor hex/oklch estrita,
// número finito, atributo em [a-z0-9-]) e escreve num <style> próprio + atributos data-opt-* no
// <html>. Nada de texto livre chega ao CSS. Edições estruturais (tema, seções, layout) não passam
// por aqui: o admin salva o rascunho e recarrega o iframe.
export const PREVIEW_BRIDGE_UPDATE = "venore-theme-preview:update";
export const PREVIEW_BRIDGE_READY = "venore-theme-preview:ready";

export type PreviewBridgeUpdate = {
  type: typeof PREVIEW_BRIDGE_UPDATE;
  tokens?: { light?: Record<string, string>; dark?: Record<string, string> };
  options?: Record<string, string | number | boolean | null>;
  // Unidade de cada opção numérica (range), validada contra a lista do contrato.
  optionUnits?: Record<string, string>;
};

const STYLE_ID = "theme-preview-bridge";
const NAME_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const ATTRIBUTE_VALUE_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ALLOWED_UNITS = new Set(["", "rem", "px", "%", "ms", "deg"]);

function declarations(tokens: Record<string, string> | undefined): string {
  if (!tokens || typeof tokens !== "object") return "";
  return Object.entries(tokens)
    .filter(([name, value]) => NAME_PATTERN.test(name) && typeof value === "string" && THEME_COLOR_VALUE_PATTERN.test(value))
    .map(([name, value]) => `--${name}:${value};`)
    .join("");
}

// CSS gerado a partir de uma mensagem já validada campo a campo (exportado para teste).
export function buildPreviewBridgeCss(message: PreviewBridgeUpdate): string {
  const light = declarations(message.tokens?.light);
  const dark = declarations(message.tokens?.dark);
  const optionVars = Object.entries(message.options ?? {})
    .filter(([key, value]) => NAME_PATTERN.test(key) && (typeof value === "number" ? Number.isFinite(value) : typeof value === "string" && THEME_COLOR_VALUE_PATTERN.test(value)))
    .map(([key, value]) => {
      if (typeof value === "string") return `--opt-${key}:${value};`;
      const unit = message.optionUnits?.[key] ?? "";
      return `--opt-${key}:${value}${ALLOWED_UNITS.has(unit) ? unit : ""};`;
    })
    .join("");
  const rules: string[] = [];
  if (light || optionVars) rules.push(`html[data-theme]{${light}${optionVars}}`);
  if (dark) rules.push(`html[data-theme].dark{${dark}}`);
  return rules.join("\n");
}

// Atributos data-opt-* para opções boolean/select (exportado para teste).
export function previewBridgeAttributes(message: PreviewBridgeUpdate): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(message.options ?? {})) {
    if (!NAME_PATTERN.test(key)) continue;
    if (typeof value === "boolean") attributes[`data-opt-${key}`] = String(value);
    else if (typeof value === "string" && ATTRIBUTE_VALUE_PATTERN.test(value)) attributes[`data-opt-${key}`] = value;
  }
  return attributes;
}

function isUpdate(data: unknown): data is PreviewBridgeUpdate {
  return Boolean(data) && typeof data === "object" && (data as { type?: unknown }).type === PREVIEW_BRIDGE_UPDATE;
}

export function PreviewBridge(): null {
  useEffect(() => {
    if (window.parent === window) return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || !isUpdate(event.data)) return;
      let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
      if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.body.appendChild(style);
      }
      style.textContent = buildPreviewBridgeCss(event.data);
      for (const [name, value] of Object.entries(previewBridgeAttributes(event.data))) {
        document.documentElement.setAttribute(name, value);
      }
    };

    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: PREVIEW_BRIDGE_READY }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return null;
}
