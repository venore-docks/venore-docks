// Locale e direção do documento (settings platform.locale/textDirection, spec §4.1). Dono: W8 —
// na Fase F, o que o <html> já declarava: pt-BR, ltr.
export async function resolveDocumentLocale(): Promise<{ locale: string; dir: "ltr" | "rtl" }> {
  return { locale: "pt-BR", dir: "ltr" };
}
