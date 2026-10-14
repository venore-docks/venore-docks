import { resolveDocumentModel } from "@/platform/theme-rendering/document-model";
import { renderTemplate } from "@/platform/theme-rendering/render-template";
import { resolveThemeStrings } from "@/platform/theme-rendering/resolve-theme-strings";

// 404 dentro da Shell (escada de erro, spec v8 §6/§7.9): todo notFound() do catch-all do CMS e
// das rotas de plugin cai aqui, ainda com header/rail/footer. Template "notFound" do tema (ou do
// kit). Dono: W4.
export default async function PlatformNotFound() {
  const doc = await resolveDocumentModel();
  return renderTemplate(doc.theme, "notFound", {
    homeHref: "/",
    jsonLd: null,
    outlets: { before: null, after: null },
    strings: resolveThemeStrings(doc.theme, doc.locale),
    locale: doc.locale,
    dir: doc.dir,
    options: doc.options.values,
    area: doc.area,
  });
}
