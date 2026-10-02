# Sistema de temas: contrato 8.0.0

> Documento de arquitetura (o *porquê* e o *como usar*). A spec de engenharia completa, com tipos, arquivos e plano de workstreams, é `/home/user/v8/spec.md`. Se este documento e o código divergirem, vale o código, e a divergência vai para "Known Gaps" no AGENTS.md.

## 1. Conceitos

- **Tema** é um pacote `@venore/theme-*`. Só o `venore-slime` mora no core: ele é o tema padrão e o fallback imutável.
- **Kit** (`@venore/theme-sdk/kit`) é a implementação padrão de cada peça: layouts, regiões, templates, estados e hooks. Na prática, o kit *é* o Slime de hoje, e um tema que não declara nada renderiza igual ao Slime.
- **`ThemeDefinition`** é o único conceito novo. É criado com `defineTheme()` e exportado em `<pacote>/theme`. Cada campo é opcional e cai no kit quando ausente.
- **O core continua dono** de dados, rotas, permissões, comportamento e acessibilidade. O tema recebe props prontas e nunca busca dado. A exceção continua sendo `useTheme()`.

## 2. Fronteira: o que um tema pode e o que não pode

| Pode | Não pode |
|---|---|
| Remodelar todo o layout e o design do site público: tokens, opções, arranjo, regiões, templates, estados, variantes de bloco, estilos de seção | Buscar dados, criar rotas, mudar permissões, importar internals de contexts, plugins ou `platform` |
| Estilizar páginas de plugin via tokens, e colocar conteúdo em volta delas via outlets e regiões | Alterar o markup interno de páginas de plugin (ele pertence ao plugin) |
| Dar cor e marca ao admin | Mudar a estrutura, as fontes ou as opções do admin (`/admin/**` usa sempre o layout `topbar` do kit) |
| Adicionar variantes de apresentação a blocos | Alterar o schema de conteúdo dos blocos (ele pertence ao core e aos plugins) |

A área (`public` ou `admin`) é decidida **só pelo caminho**, nunca pelo `navMode`.

## 3. As camadas

- **L1, tokens em 3 níveis.**
  - Primitivos: `--<tema>-*`, `--radius`, `--ui-*`.
  - Semânticos: o vocabulário shadcn mais os tokens de warning, sidebar e header, que não mudam.
  - Por região: `--region-{header|rail|contextual|content|footer}-<papel>` e `--section-<estilo>-<papel>`.

  Dentro de `[data-region="rail"]` o core remapeia `--background`, `--muted-foreground` e os demais tokens para os valores da região. Assim `bg-card` e `text-muted-foreground` passam a seguir o tom da região. Os defaults ficam em `src/app/styles/region-tokens.css`, só com `var()` e sob `:where([data-theme])`. Nenhum valor de design vai para `globals.css`.
- **L2, opções.** O tema declara `options` no manifesto, com os tipos boolean, select, range, color, font, text e media. O admin gera o formulário automaticamente. Os valores são persistidos em `theme.config`, separados por tema. Na página, select e boolean viram `data-opt-<chave>` no `<html>`, range e color viram `--opt-<chave>`, e o `theme.css` decide o que cada valor significa.
- **L3, arranjo.** Há dois presets: `topbar` (o Slime) e `rail` (a Aurora). O tema também pode fornecer o próprio componente de layout, que recebe as regiões já renderizadas.
- **L4, regiões substituíveis.** As regiões são header, rail, footer, breadcrumbs, userMenu, contextualBar e mobileNav. Um override é um *server component* e recebe `Default`, que é a região do kit, para poder envolvê-la. Se o override falhar, o core renderiza a região do kit no lugar. Os hooks do kit cobrem drawer, focus trap, scroll lock com contagem de referências, colapso com cookie e store otimista, e o estado de scroll do header.
- **L5, templates.** Existem templates para home, entry, category, account, login e notFound, cada um com variantes opcionais. Formulários, JSON-LD e dados chegam do core já prontos.
- **L6, page builder.**
  - Variantes de bloco: a escolha fica gravada em `data.presentationVariant`. O editor lista as variantes do tema ativo, e uma variante desconhecida cai no renderer do core.
  - Estilos de seção: `default`, `muted`, `brand`, `inverted`, `accent`, e o tema pode acrescentar outros.
  - Layout por página: a largura, o rail e a posição da barra contextual ficam em `entries.data.layout`, sem migration. Como o `(platform)/layout` não re-renderiza na navegação soft, a página emite um marcador oculto (`data-page-*`) e `src/app/styles/page-layout.css` aplica largura, rail e barra contextual por `:has()`. Por isso a rail é sempre montada quando habilitada: o CSS a esconde a partir de lg, e abaixo disso ela continua sendo o drawer da navegação mobile. Lacuna conhecida: barra contextual `top` × `side` só muda num reload.

## 4. Como escrever um tema

```
@venore/theme-x/
  package.json   "venoreTheme": { "contract": "8.0.0", "key": "x", "extends"?: "aurora", "messages"?: {...} }
  manifest.ts    ThemeManifest (themeContractVersion "8.0.0", options, palette, layout, fonts, ...)
  theme.ts       export const xTheme = defineTheme({ manifest, layout: "rail", regions: { footer: MeuFooter } })
  theme-client.ts (opcional, "use client")  ErrorState
  theme.css      [data-theme="x"] { ... }  [data-theme="x"].dark { ... }
  color-palettes.ts, messages/*.json, assets/* (opcionais)
```
O caminho mínimo são `package.json`, `manifest.ts`, um `theme.ts` vazio e um `theme.css` que declara só os tokens alterados, com `extends: "venore-slime"`. Para validar o tema localmente, use `npm run theme:check -- x`.

Regras práticas:
- Regiões são síncronas e recebem `strings` e opções como dados.
- Use `t(strings, chave)`.
- Use propriedades lógicas: `ms-`, `pe-`, `start-`.
- Não importe `@/` nem plugins.

## 5. Herança

`extends` aceita até 3 níveis. O codegen reescreve os seletores dos ancestrais para `:is([data-theme="pai"],[data-theme="filho"])`, com a mesma especificidade, e o filho declara só as diferenças. O `<html>` continua com uma única chave em `data-theme`.

- **Código:** o filho vence por chave. O override do filho recebe a região do pai como `Default`.
- **Opções:** são mescladas por chave. `removeOptions` esconde opções herdadas.
- **Mensagens:** merge profundo por locale.
- **Paletas:** a união das paletas do pai e do filho.

Um pai 7.x só serve de base de tokens e paletas para o filho.

Lacuna conhecida: um `url()` **relativo** dentro de uma regra escopada de um ancestral resolveria a partir de `src/themes/` na cópia da linhagem. Nenhum tema instalado usa (só `data:`); `@font-face` e `@import` não são copiados, porque já vêm do import do ancestral.

## 6. Rascunho, preview, histórico e rollback

- A configuração **publicada** fica na setting `theme.config`, lida uma vez por request. Ela guarda o tema, a paleta, as opções, as fontes, os assets e as seções. O **rascunho** e os **últimos 20 publicados** ficam na tabela `themes.theme_config_revisions`.
- Na publicação, o histórico é gravado primeiro, numa transação, e depois a setting. Se a gravação da setting falhar, a publicação é revertida. As chaves legadas (`theme.active`, `theme.activePaletteId`, `theme.customColorPalette.*`) também são gravadas, então um rollback de deploy continua seguro. Toda publicação, rollback, exportação e importação gera auditoria.
- Em `/admin/themes/customize` ficam os painéis de edição e um iframe com o site. O preview usa um cookie HMAC, vinculado ao usuário e válido por no máximo 2 h, e só vale para quem tem `settings.manage`. Edições de token aparecem na hora; edições estruturais salvam o rascunho e recarregam o iframe.
- A página de render nunca depende da tabela nova. Se ela não existir (por exemplo, num preview da Vercel sem migration), o admin mostra um aviso e o site segue normal.

## 7. Variação por seção do site

`theme.config.sections[]` define overrides por prefixo de caminho, por exemplo `/rh`. Um override pode trocar o tema, o preset de layout, o mobileNav, o layout de página, a variante de template, a paleta ou as opções. O prefixo é normalizado (decode, NFC, minúsculas, sem barra final), e o casamento é pelo prefixo mais longo, respeitando os limites de segmento. Os prefixos `/admin`, `/ext`, `/api` e `/login` são reservados.

## 8. Outlets de plugin

O plugin declara `contributions.outlets: [{ key, outlet, order?, areas?, match?, render }]`, e também os declara no manifesto para aparecerem no diagnóstico. Os outlets disponíveis são: `header.start`, `header.end`, `rail.top`, `rail.bottom`, `content.before`, `content.after`, `contextual.top`, `contextual.bottom`, `footer.top`, `footer.bottom`, `userMenu.items`, `home.showcase` e `entry.after-content`.

Só plugins ativos participam. A ordem é determinística: `order`, depois a chave do plugin, depois a chave da contribuição. Cada contribuição roda isolada, com try/catch, timeout, `Suspense` e error boundary. Temas 7.x recebem apenas `content.before` e `content.after`.

## 9. Barra contextual como região

A barra contextual agora é um dado explícito: `none`, `menu` ou `plugin`. Isso corrige três bugs:
- **B1:** padrões de rota de plugins inativos não abrem mais a barra.
- **B2:** o `scopePath` é normalizado ao gravar e ao ler.
- **B6:** quando o resultado é `none`, não aparece aside vazio. Rotas de plugin podem declarar `isEmpty`.

## 10. Fontes e assets

O core mantém um registro curado de fontes `next/font`: Geist, Inter, Manrope, Fraunces, Noto Sans Arabic, Noto Sans Hebrew, entre outras. Só a Geist faz preload. O tema, ou o admin, escolhe uma fonte para cada papel: sans, display e mono. O admin sempre usa a Geist. Assets como a imagem OG padrão e os ícones são imports estáticos do pacote, então ganham URL com hash.

## 11. SEO

- `themeColor` claro e escuro vem de `seo.themeColor` ou é derivado do `--header-bg`.
- O web manifest pega cores, ícones, `lang` e `dir` do tema e das configurações.
- A imagem OG padrão é a do tema, a menos que a do admin a substitua.
- O core monta o JSON-LD de cada template (WebSite, Article, CollectionPage) a partir de dados já filtrados por visibilidade.
- Em temas 7.x, o JSON-LD do breadcrumb passou a ser renderizado pelo core, o que fechou uma XSS presente em 12 pacotes.

## 12. Comportamento responsivo

O manifesto declara `responsive.mobileNav` como `drawer`, `bottom-bar` ou `fullscreen`, e o kit implementa os três modos. Também declara `contextualBarMobile` como `top-collapsible`, `bottom` ou `hidden`. Em todas as classes de layout vale a regra mobile first da seção 4 do AGENTS.md.

## 13. Estados de página

- **not-found:** renderizado dentro do Shell.
- **error:** client-side. O componente carrega o ErrorState do tema depois de montar.
- **app/error.tsx:** pega erros vindos do layout.
- **global-error:** estático.
- **empty, forbidden e maintenance:** quando o modo manutenção está ativo, quem não é admin vê a tela de manutenção com 200 e `noindex`.
- **loading:** só como fallback de `Suspense` dentro dos templates. Não existe `loading.tsx` no grupo `(platform)`, porque ele transformaria os 404 em 200.

## 14. Exportar e importar

`GET /api/themes/config/export` gera o JSON `venore-theme-config` v1. A importação valida o arquivo com zod e contra o registro local, descarta opções inválidas com aviso e **sempre cria um rascunho**, nunca publica direto. As duas operações exigem `settings.manage` e geram auditoria.

## 15. i18n e RTL

As settings `platform.locale` e `platform.textDirection` definem `<html lang dir>`. O kit traz catálogos para pt-BR, en, es e ar, e o tema pode sobrescrever chaves. A busca de uma chave segue a ordem locale, idioma, pt-BR e, por último, a própria chave. As regiões recebem `strings` como dados e usam `t()`. O kit usa só propriedades lógicas, e o lint impede o uso de `ml-`, `pr-`, `text-left` e similares.

## 16. Orçamento de performance

O CI mede três coisas por tema: o `theme.css` gzip, o CSS de linhagem e o JS client gerado pelo esbuild. Os orçamentos padrão são 6 KB de CSS e 12 KB de JS client, ambos gzip. O manifesto pode baixar esses valores, ou subir até 2×.

## 17. Galeria viva

`/admin/themes/gallery?theme=&mode=&locale=&dir=` mostra regiões, layouts a 390 px e a 1280 px, templates, estados, cada bloco com suas variantes, estilos de seção e a tabela de tokens com o contraste por região. Funciona para qualquer tema instalado sem precisar ativá-lo. Os fixtures da galeria são os mesmos usados no CI.

## 18. Paleta e contraste

Um único gerador (`generateThemePalette`) respeita as regras do tema. Por exemplo, `rail: { tone: "dark" }` mantém o rail escuro nos dois modos. O gerador produz também os tokens de região. O contraste é verificado por região, nos modos claro e escuro: 4,5 para texto e 3 para ring e accent. Uma paleta custom que viola essas regras é recusada, com a lista das regiões afetadas.

## 19. CI

- **Job `check`.** Roda:
  - os invariantes do registro;
  - o contrato de tokens considerando a herança;
  - o contraste por região, com baseline;
  - o orçamento;
  - o snapshot de paridade do Slime;
  - o harness SSR de cada tema em vários cenários.

  O harness verifica landmarks, a presença de outlets e o escape de JSON-LD.
- **Job `themes`.** Não usa banco nem build. Roda o harness SSR (`vitest.themes.config.ts`) e o Playwright (`playwright.themes.config.ts`) com `setContent` nas viewports 390×844 e 1280×800, nos modos claro e escuro. Verifica que não há overflow horizontal, que o Tab alcança a navegação e que o axe passa contra o baseline. Os screenshots são publicados como artefatos e não servem como gate de pixel.
- **Baselines (catraca).** A dívida dos Shells 7.x fica em `e2e-themes/a11y-baseline.json` (Playwright: axe, teclado, overflow) e em `src/themes/theme-ssr.baseline.json` (harness SSR); a do contraste por região, em `src/themes/a11y-baseline.json`. Problema novo reprova. Problema resolvido também reprova no CI do core, para o baseline só encolher; no `theme:check` de um repositório de tema (`VENORE_THEME_KEYS` definido) ele só gera aviso. O overflow horizontal é gate duro só no kit v8: o Venore Slime e todo tema v8 não podem ter dívida.
- **Atualizar um baseline** depois de uma mudança intencional: `UPDATE_THEME_A11Y_BASELINE=1 npx playwright test -c playwright.themes.config.ts`, `UPDATE_THEME_SSR_BASELINE=1 npx vitest run -c vitest.themes.config.ts src/themes/theme-ssr.harness.test.tsx` e `UPDATE_A11Y_BASELINE=1 npx vitest run src/themes/theme-contrast.test.ts`.
- **`npm run theme:check`** (`-- --theme <chave>` para um tema só, `--no-browser` sem Playwright) roda o mesmo conjunto: codegen estrito, contrato de tokens, contraste, orçamento, harness SSR e Playwright.
- **Workflow reutilizável `theme-check.yml`.** Os repositórios de tema o rodam antes de criar uma tag.

## 20. Operação e falhas

A escada de fallback é:
1. região quebrada → região do kit;
2. tema ausente, desativado ou fora do range → Slime;
3. opção inválida → valor default;
4. falha ao ler a config → última config boa, e depois as chaves legadas.

Além disso:
- O codegen roda em modo estrito no `prebuild`: um tema inválido derruba o build, e o deploy anterior continua no ar.
- `THEME_FORCE_FALLBACK=1` força o Slime para todo mundo.
- O safe mode (`/api/themes/safe-mode?on=1`) força o Slime só para o admin que o ativou.

### Runbook: tema quebrado em produção

**Sintoma só no navegador de quem está mexendo** (rascunho em preview, tema de uma seção, opção nova): use o **safe mode**.
1. Logado com `settings.manage`, abra `https://<site>/api/themes/safe-mode?on=1` (ou o botão "Modo seguro" em `/admin/themes`). O servidor assina um cookie `venore-theme-preview` com o seu id de usuário, válido por no máximo 2 h.
2. A partir daí, **só você** vê o Venore Slime com a configuração padrão, no site e no admin. Os outros visitantes continuam vendo o tema publicado. Em `/ext/**` o cookie é ignorado.
3. Corrija pelo admin: descarte o rascunho (`/admin/themes/customize`) ou restaure uma publicação anterior (`/admin/themes/history` → Restaurar, que publica uma revisão nova).
4. Saia com `https://<site>/api/themes/safe-mode?on=0` ou com "Sair do modo seguro" na faixa inferior. O cookie também vence sozinho em 2 h, e perde o efeito se você perder `settings.manage`.

**Sintoma para todo mundo** (o tema publicado derruba o layout, o admin não abre): use `THEME_FORCE_FALLBACK`.
1. Na Vercel, em *Settings → Environment Variables* do projeto, defina `THEME_FORCE_FALLBACK=1` em Production e faça *Redeploy* do último deploy (variável de ambiente só vale num deploy novo). Em self-host, defina a variável e reinicie o processo.
2. O render ignora config, cookie de preview e seções: todo request usa o Slime com os padrões, e o diagnóstico vira `forced-fallback`. Nada é gravado; a config publicada continua intacta.
3. Com o admin de pé, restaure a publicação anterior em `/admin/themes/history` ou corrija o rascunho e publique. Se o problema for o pacote do tema, desabilite o tema no catálogo ou volte a versão do pacote.
4. Remova a variável (ou ponha `0`) e faça *Redeploy*.

**Notas.**
- A publicação grava também as chaves 7.x (`theme.active`, `theme.activePaletteId`, `theme.customColorPalette.*`). Então um rollback de **deploy** para uma versão anterior à v8 continua mostrando o mesmo tema e as mesmas cores.
- Sem a tabela `themes.theme_config_revisions` (um preview sem migration), o site renderiza normalmente. Só rascunho e histórico ficam indisponíveis, e o admin avisa.
- Headers `x-venore-theme-*` vindos de fora são descartados pelo proxy. Override de tema só existe por cookie assinado.

## 21. Compatibilidade 7.x e migração

- **O que se mantém.** O range suportado passa a ser `>=7.0.0 <9.0.0`. Os 12 pacotes 7.x funcionam **sem mudança**: o adapter chama o `Shell` com as mesmas props de hoje. A exceção é que `breadcrumbsJsonLd` agora é sempre `null`, já que o core renderiza o JSON-LD, e `sidebarContextual` fica `null` quando não há conteúdo. No admin, eles continuam usando o próprio Shell.
- **O que eles ganham.** Templates e estados do kit, que são o markup atual, SEO derivado dos tokens, checagem de contraste e presença na galeria e no CI.
- **O que não ganham.** Opções, regiões, outlets fora de `content.*`, variantes de bloco, fontes e RTL dentro do Shell.

Para migrar um pacote 7.x para 8.0:
1. Adicione `venoreTheme` ao `package.json` e mude `themeContractVersion` para `"8.0.0"`.
2. Crie `theme.ts` com `defineTheme`, escolhendo o preset mais próximo e listando apenas as regiões que realmente diferem do kit.
3. Apague os componentes que viraram cópia do kit.
4. Troque escopos próprios, como `[data-aurora-rail]`, por tokens de região em `[data-region=...]`.
5. Mantenha o `Shell` exportado em `index.ts` por uma versão, para cores antigos.
6. Rode `npm run theme:check` e o workflow `theme-check`.

A Aurora 0.2.0 é o piloto dessa migração.
