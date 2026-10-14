// Stub de `server-only` para Vitest (processo Node puro, sem a condição "react-server" do bundler
// do Next). O pacote real lança no import fora de um Server Component; em teste unitário, o grafo
// dos plugins instalados (block renderers, contributions) chega nele por caminhos que nenhum teste
// precisa isolar. A garantia de verdade continua sendo do build do Next.
export {};
