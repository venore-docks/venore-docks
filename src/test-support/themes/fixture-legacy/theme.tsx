import type { ThemeManifest, ThemeShellProps } from "@/contexts/themes/contracts/types";

// Fixture de pacote 7.x (Shell inteiro, renderizado pelo legacy-shell-adapter). Substitui, nos
// testes, os pacotes @venore/theme-* 7.x reais — que nem sempre estão instalados no branch.
export const fixtureLegacyManifest: ThemeManifest = {
  key: "fixture-legacy",
  name: "Fixture Legacy",
  version: "7.0.0",
  themeContractVersion: "7.0.0",
  brandAesthetics: { mode: "svg", size: 100, scrolledSize: 90, position: "left", color: "#123456" },
  colorModes: ["light", "dark"],
};

export function FixtureLegacyShell({ children }: ThemeShellProps) {
  return (
    <div data-fixture="legacy-shell">
      <header id="site-header">Fixture Legacy</header>
      <main id="main-content">{children}</main>
    </div>
  );
}
