// Serializa um objeto pra dentro de <script type="application/ld+json">. JSON.stringify sozinho
// NÃO serve: ele não escapa `<`, então um texto com `</script><script>…` fecha a tag e executa
// script (XSS armazenado — um título de entry vira código no navegador de quem abre a página).
// Escapar `<`, `>` e `&` como </>/& mantém o JSON idêntico pro parser de JSON-LD e
// impossível de interpretar como HTML; U+2028/U+2029 quebram parsers JS antigos.
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// Defesa na ORIGEM do dado, pra temas que ainda serializam com JSON.stringify cru (os pacotes
// @venore/theme-* vivem em outros repositórios): troca `<`/`>` por aspas angulares simples
// (‹ ›), visualmente equivalentes, num texto que só vai pra dado estruturado — nunca pra tela.
export function toJsonLdSafeText(text: string): string {
  return text.replace(/</g, "‹").replace(/>/g, "›");
}
