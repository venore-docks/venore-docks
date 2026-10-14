import Link from "next/link";
import { getSettingsPageData } from "@/platform/admin-shell/get-settings-page-data";
import { ThemesTabs } from "./_layout/themes-tabs";
import { ThemesAccessDenied } from "./_layout/themes-access-denied";
import { CatalogSection } from "./_sections/catalog-section";
import { ConfigSection } from "./_sections/config-section";
import { HeaderBehaviorSection } from "./_sections/header-behavior-section";
import { OptionsSection } from "./_sections/options-section";
import { PaletteSection } from "./_sections/palette-section";

// Aba "Catálogo" de /admin/themes. Só gate + composição: cada seção (_sections/*) busca o próprio
// dado e tem dono próprio (spec v8 §9) — catálogo e header (F), paleta (W1), opções (W2),
// rascunho (W6).
export default async function ThemesAdminPage() {
  const gate = await getSettingsPageData();

  if (!gate.granted) {
    return <ThemesAccessDenied />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Aparência</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o tema visual usado no site, ajuste o comportamento do header e as cores, entre os temas
          instalados e habilitados. <Link href="/admin/themes/preview" className="text-primary underline">Ver amostra dos temas</Link>.
        </p>
      </div>

      <ThemesTabs current="catalog" />
      <ConfigSection />
      <CatalogSection actor={gate.actor} />
      <HeaderBehaviorSection />
      <OptionsSection />
      <PaletteSection />
    </div>
  );
}
