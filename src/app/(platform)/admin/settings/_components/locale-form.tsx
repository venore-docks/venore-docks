import { getSetting } from "@/contexts/settings";
import { resolveDocumentLocale, TEXT_DIRECTION_SETTING_KEY } from "@/platform/theme-rendering/resolve-document-locale";
import { isTextDirectionSetting } from "@/shared/locale";
import { LocaleFormFields } from "./locale-form-fields";

// Idioma e direção do site (spec v8 §4.1/§7.11). A página de configurações já passou pelo gate
// (getSettingsPageData → settings.manage); a action autoriza de novo.
export async function LocaleForm() {
  const [{ locale }, direction] = await Promise.all([resolveDocumentLocale(), getSetting({ key: TEXT_DIRECTION_SETTING_KEY })]);
  const savedDirection = direction.success && direction.data ? direction.data.value : "auto";
  return (
    <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
      <h2 className="text-sm font-semibold text-foreground">Idioma do site</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Define o idioma do site público (atributo <code>lang</code>, textos do tema, manifest e RSS) e a direção do texto. Em
        &quot;Automática&quot;, árabe, hebraico, persa e urdu ficam da direita para a esquerda.
      </p>
      <div className="mt-3">
        <LocaleFormFields locale={locale} textDirection={isTextDirectionSetting(savedDirection) ? savedDirection : "auto"} />
      </div>
    </section>
  );
}
