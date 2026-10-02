// Mock de `next/font/google` para testes que importam o registro de fontes
// (platform/theme-fonts/registry.ts) — next/font só roda dentro do bundler do Next. Cada família
// devolve `variable` = "var-<variável css>" e guarda as opções recebidas em `calls`.
// Uso: vi.mock("next/font/google", async () => (await import("@/test-support/themes/next-font-google-mock")).nextFontGoogleMock());
export const NEXT_FONT_FAMILIES = [
  "Geist",
  "Geist_Mono",
  "Inter",
  "Manrope",
  "Space_Grotesk",
  "Fraunces",
  "Playfair_Display",
  "Source_Serif_4",
  "JetBrains_Mono",
  "IBM_Plex_Mono",
  "Noto_Sans_Arabic",
  "Noto_Sans_Hebrew",
] as const;

export type NextFontCall = { family: string; options: { variable?: string; preload?: boolean; subsets?: string[] } };

export function nextFontGoogleMock(calls: NextFontCall[] = []): Record<string, (options: NextFontCall["options"]) => unknown> {
  return Object.fromEntries(
    NEXT_FONT_FAMILIES.map((family) => [
      family,
      (options: NextFontCall["options"]) => {
        calls.push({ family, options });
        return { className: `cls-${family}`, variable: `var${options.variable ?? ""}`, style: { fontFamily: family } };
      },
    ]),
  );
}
