import { PANEL_CLASS } from "../customize/_components/field-styles";
import { loadThemeCustomizeData } from "@/platform/theme-engine/theme-config";
import { toSchemaFormFields, toSchemaFormValues } from "@/platform/theme-engine/theme-options";
import { OptionsForm } from "../_components/options-form";

// Opções do tema em edição (formulário gerado do manifesto, spec v8 §2.3). Dono: W2. Salva no
// rascunho (publicar é em Personalizar/config). Tema sem opções ⇒ a seção não aparece.
export async function OptionsSection() {
  const loaded = await loadThemeCustomizeData();
  if (!loaded.success || loaded.data.theme.options.length === 0) return null;
  const { theme, document, storageUnavailable } = loaded.data;
  return (
    <section className={PANEL_CLASS} aria-labelledby="theme-options-title">
      <h2 id="theme-options-title" className="text-sm font-semibold text-foreground">
        Opções do tema {theme.manifest.name}
      </h2>
      <p className="text-xs text-muted-foreground">As mudanças vão para o rascunho; publique em Personalizar.</p>
      <OptionsForm
        themeKey={theme.key}
        fields={toSchemaFormFields(theme)}
        values={toSchemaFormValues(theme.options, document.byTheme[theme.key]?.options)}
        disabled={storageUnavailable}
      />
    </section>
  );
}
