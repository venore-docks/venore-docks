# Changelog

Histórico de mudanças do core do Venore Docks (`venore-docks-1.0.0`, pasta `venore-docks/`).
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versão segue
`package.json#version`, que é o número de release do core em si — **não** confundir com
`CORE_VERSION` (`src/platform/plugin-engine/core-version.ts`, só bump em mudança que quebra
compatibilidade de plugin) nem com o "Version do documento" no cabeçalho de
`docs/venore-docks.md` (revisão da doc, não do código).

Cada entrada linka o(s) branch(es)/instância(s) que já receberam o fix quando isso não é óbvio —
o core evolui em `main` e se propaga pras instâncias (branches deste repo, ou forks) por merge;
uma instância só tem o fix depois que a própria instância faz esse merge (ver seção "Modelo de
atualização" em `VENORE-DOCKS.md`).

## [0.5.0] - 2026-09-25

### Added

- **`<head>` de rota pública de plugin (title, description, Open Graph).** A entrada `public` da
  `route-table.ts` de um plugin aceita `generateMetadata` opcional — mesma assinatura do
  `generateMetadata` de um `page.tsx`, com `asPluginMetadata` pra variância de params (mesmo motivo
  de `asPluginPage`). O catch-all do CMS ganhou `generateMetadata` que chama o do plugin; sem ele a
  página herda o metadata do layout raiz como antes. Primeiro uso: preview de link no WhatsApp da
  página do jogo do `erasto-league` (capa do jogo como `og:image`). Resolução da rota memoizada por
  request (metadata e página não leem o registro de plugins duas vezes); erro no metadata de um
  plugin cai pro metadata herdado em vez de derrubar a página.

### Fixed

- **Migration nova de plugin já instalado agora se aplica sozinha no deploy.** Bump de tag de um
  plugin com migration nova não aplicava nada até alguém rodar `npm run db:update` — e instância na
  Vercel não tem onde rodar isso. O `prebuild` agora roda `db:migrate:plugins`
  (`scripts/migrate-installed-plugins.ts`) depois do `drizzle-kit migrate` do core: migrations
  pendentes de todo plugin **instalado** (plugin nunca instalado é pulado — a primeira migration
  continua sendo do install). Falha derruba o build, como a migration do core (a Vercel mantém o
  deploy anterior). `db:update` continua existindo pro fluxo local.

## [0.4.0] - 2026-09-24

### Changed

- **"Paleta de cor" agora também muda sidebar, header e fundo de página.** Feedback direto sobre
  a v0.3.0: "a paleta muda só alguns elementos, sidebar nunca muda". Investigando o `theme.css`
  dos 16 temas + venore-slime, achamos que sidebar (`--sidebar-bg-start/end` + variante `-admin`),
  header (`--header-bg`) e o fundo degradê da página (`--app-bg-start/mid/end`) usam uma família
  de tokens própria, consistente em todo o workspace (mesmo scaffold de `@venore/theme-sdk`), mas
  fora do vocabulário que a paleta cobria — não é hardcode de plugin/tema (são `var(...)`
  legítimos), só faltava vocabulário aqui. `PaletteColorToken` (contracts/types.ts) ganhou 16
  tokens novos: `card/-foreground, popover/-foreground, muted/-foreground, border, input`
  (vocabulário mínimo, VENORE-DOCKS.md §7) + a família sidebar/header/app-bg — total 25.
  `buildFullPaletteFromSeed` gera todos a partir da mesma cor de entrada; a seção "Avançado" ganhou
  2 grupos novos ("Superfícies" e "Sidebar, header e fundo") pra ajuste manual. Deliberadamente
  FORA do vocabulário: `destructive/success/warning` (cor semântica, não deve seguir a marca) e
  `chart-*` (paleta categórica, precisa ficar distinguível).

## [0.3.0] - 2026-09-24

### Changed

- **"Paleta de cor" agora gera a paleta INTEIRA, não só primary/accent.** Feedback direto sobre a
  v0.2.0: os presets do catálogo (Espaço/Ametista/Âmbar/Rubro) só rotacionavam 5 tokens de marca,
  e "1 cor de marca" mesclava só esses 5 em cima do que já estava salvo — os outros 4 tokens
  (`secondary/-foreground, background, foreground`) ficavam sem valor nenhum e apareciam pretos no
  formulário "Avançado". Substitui o mecanismo por `buildFullPaletteFromSeed`
  (`full-palette-generator.ts`): a partir de 1 cor só, monta os 9 tokens de uma vez — fundo/
  secundária como *shades* da cor de entrada (mesmo matiz, luminosidade/chroma diferentes),
  destaque (`accent`) no matiz COMPLEMENTAR (oposto no círculo de cor), contraste texto/fundo
  sempre alto. "1 cor de marca" agora sobrescreve a paleta personalizada inteira (não mescla mais
  — não sobra nada "só do tema" pra preservar, já que os 9 tokens são gerados juntos). Os presets
  do catálogo passam a funcionar como atalhos pro mesmo gerador (extraem o `primary` já resolvido
  do preset como semente) em vez de ativar o preset estático do pacote do tema — por isso ficam
  salvos e ativados como "Personalizada", não mais como o id do preset em si.
- **`venore-theme-aurora` (repo próprio, não faz parte deste pacote): renomeia presets.** "FEM"
  (petróleo/teal) virou "Oceano" — a cor lê mais como oceano que o preset girado original, que
  passou a se chamar "Espaço". Id de cada preset continua estável (`fem`, `oceano`), só o nome
  exibido mudou. Bump pendente do pacote (ver o próprio changelog do tema).

## [0.2.0] - 2026-09-24

### Added

- **Cor de marca em `/admin/themes` → "Paleta de cor".** Até agora, "Personalizada" só deixava
  editar `primary/secondary/background/foreground` — quatro tokens quase-neutros que não mudavam
  nada visível na prática (a identidade de cor de um tema mora em `primary/-foreground,
  accent/-foreground, ring`, confirmado comparando `theme.css` do Aurora com o do Harbor, um
  recolor manual do Aurora). Agora existe um controle principal de 1 cor: o admin escolhe uma cor
  de marca, o core gira o matiz (hue) dela sobre esses 5 tokens do tema ativo preservando
  luminosidade/contraste de cada um (mesmo princípio que já movia os presets do catálogo), sem
  precisar publicar um novo pacote de tema só pra trocar de cor. O formulário de tokens anterior
  virou uma seção "Avançado" (fechada por padrão), ampliada de 4 pra 9 tokens
  (`primary/-foreground, secondary/-foreground, background, foreground, accent/-foreground,
  ring`) pra quem quiser ajuste fino além do que a derivação automática cobre. Nenhuma mudança em
  `@venore/theme-*`: o mecanismo lê o catálogo já publicado do tema ativo em runtime.

## [0.1.1] - 2026-09-24

### Fixed

- **Upload de mídia silencioso ("nada acontece") em `/admin/media`.** O form de upload sempre
  mandava o arquivo inteiro por server action (buffered); a Vercel tem um teto de 4.5MB pro corpo
  de uma serverless function, hardcoded pela plataforma (não configurável por
  `next.config.ts#bodySizeLimit`) — qualquer arquivo entre esse teto e o limite de negócio em
  `MEDIA_ALLOWED_TYPES` (imagem até 8MB, vídeo até 200MB) falhava na infra antes de qualquer
  código da aplicação rodar, sem toast, sem erro. `upload-media-form.tsx` passou a usar o mesmo
  fluxo de ticket + upload direto ao Blob que `MediaPickerField` já tinha pra arquivo grande.
  `register-uploaded-media` (types/service/store) ganhou `visibility` opcional pra esse caminho
  não perder a escolha do seletor do form.
- **Dialog nativo de seleção de mídia (`MediaPickerField`, `MediaField`) não centralizava e ficava
  pequeno.** Preflight do Tailwind v4 zera `margin` de todo elemento (`*, ::backdrop { margin: 0
  }`), o que quebra a centralização nativa de `<dialog>` aberto via `showModal()` (depende de
  `margin: auto` da UA stylesheet). Adicionado `dialog[open] { margin: auto }` em `globals.css`;
  os dois dialogs também ficaram maiores (`w-[90vw] max-w-4xl`, scrollável, grid mais denso).
- **Bug maior: qualquer botão parava de responder a clique, em qualquer página, depois de navegar
  com o drawer de navegação mobile aberto.** `isOpen` (`mobile-nav-store.ts`, tema `venore-slime`)
  é um singleton de módulo — não reseta em navegação client-side. `SidebarNavLink` nunca fechava o
  drawer ao clicar (só `<Link>`, sem `onClick` próprio). Resultado: navegar por um link de dentro
  do drawer aberto deixava `isOpen` preso em `true`; o botão-backdrop invisível (`fixed inset-0
  z-40`, só abaixo do breakpoint `lg`/1024px) continuava montado em toda página seguinte,
  engolindo qualquer clique por trás dele — sem erro nenhum, parecia só "botão quebrado".
  Presente desde que `MobileNavDrawer` foi criado; o mesmo arquivo foi copiado pra todos os 16
  temas do catálogo, então o bug existia em toda instância. Fix: fecha o drawer sempre que a rota
  muda enquanto ele está aberto (`usePathname()` + `useEffect`).
  - Corrigido em `venore-slime` (este repo, `main` e `portal-colaborador`) e nos 16 pacotes de
    tema (`harbor`, `aurora`, `halo`, `nestpro`, `nebula`, `nite`, `nimbus`, `vega`, `volt`,
    `druids`, `knights`, `paladins`, `sorcerers`, `fearless`, `academy`, `erasto-league`) — cada
    um na branch default do próprio repo.
  - **Pendente:** pacotes de tema são consumidos por **tag** fixa no `package.json` de cada
    branch/instância (ex: `github:venore-docks/venore-theme-harbor#v0.1.5`), não pela branch
    default do tema — corrigir o repo do tema não basta, cada instância que usa aquele tema
    precisa: (1) o tema cortar uma tag nova, (2) a instância apontar o pin pra ela, (3)
    `npm install` pra atualizar o lockfile. Feito até agora só para `@venore/theme-harbor` → v0.1.6
    (branch `portal-colaborador`). Outras branches que fixam tema por tag (ex: `nestpro`, que fixa
    7 temas) ainda apontam pra versões antigas com o bug.
- **Botões nativos sem cursor de mãozinha ao passar o mouse, apesar de clicáveis.** Tailwind v4
  removeu a regra de preflight que dava `cursor: pointer` a `<button>`/`[role="button"]`
  (mudança intencional do v3→v4, documentada no upgrade guide). O primitivo `Button`
  (`components/ui/button.tsx`) já compensava isso na própria className — o problema era nos
  botões nativos soltos pelo app que não passam por ele (toggle do drawer, botões de dialog
  nativo, trigger de accordion, etc.). Restaurado globalmente em `globals.css`
  (`button:not(:disabled), [role="button"]:not([aria-disabled="true"]) { cursor: pointer }`) em
  vez de caçar cada botão nativo um a um.
