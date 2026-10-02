"use client";

import { useEffect } from "react";

// Rede de segurança pros atributos do <html>. A causa real do "ao navegar, o tema às vezes volta
// pro anterior" era o cache em memória de settings (por processo, TTL 300s) num deploy multi-
// instância — resolvido lendo theme.active sem cache. Isto cobre o resíduo: num render de cliente,
// o <html> acompanha o que o servidor resolveu mesmo que a reconciliação de atributo de <html> em
// navegação soft do App Router escorregue. Sem estado próprio — só espelha as props.
//
// O <html> do root layout não re-renderiza em navegação client-side (App Router preserva o root
// layout), então quando o tema/opção/locale muda entre páginas (seção de site com outro tema,
// troca de tema no admin seguida de router.refresh) os atributos precisam ser espelhados à mão.
// Espelha data-theme, data-opt-* (opções do tema — remove os que sumiram), lang e dir.
export function ThemeDomSync({
  themeKey,
  attributes = {},
  lang,
  dir,
}: {
  themeKey: string;
  attributes?: Record<string, string>;
  lang?: string;
  dir?: "ltr" | "rtl";
}) {
  const serializedAttributes = JSON.stringify(attributes);

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.theme !== themeKey) {
      root.dataset.theme = themeKey;
    }
    if (lang && root.lang !== lang) root.lang = lang;
    if (dir && root.dir !== dir) root.dir = dir;

    const next = JSON.parse(serializedAttributes) as Record<string, string>;
    for (const name of root.getAttributeNames()) {
      if (name.startsWith("data-opt-") && !(name in next)) root.removeAttribute(name);
    }
    for (const [name, value] of Object.entries(next)) {
      if (name.startsWith("data-opt-") && root.getAttribute(name) !== value) root.setAttribute(name, value);
    }
  }, [themeKey, serializedAttributes, lang, dir]);

  return null;
}
