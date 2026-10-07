# Changelog

Histórico de mudanças do core do Venore Docks (`venore-docks-1.0.0`, pasta `venore-docks/`).
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versão segue
`package.json#version`, que é o número de release do core em si — **não** confundir com
`CORE_VERSION` (`src/platform/plugin-engine/core-version.ts`, só bump em mudança que quebra
compatibilidade de plugin) nem com o "Version do documento" no cabeçalho de
`docs/venore-docks.md` (revisão da doc, não do código).

Cada entrada linka o(s) branch(es)/instância(s) que já receberam o fix quando isso não é óbvio —
o core evolui em `main`. Desde a entrada "Instâncias sem branch" abaixo, toda instância deste repo
faz deploy de `main` (`VENORE_INSTANCE`, AGENTS.md §8) e recebe o fix no próximo deploy; forks
continuam propagando por merge.

## [Unreleased]

**Ao atualizar uma instância:** nada obrigatório. Opcional: escolher o papel padrão de novas
contas em `/admin/settings` (sem escolha, continua valendo `RBAC_DEFAULT_REGISTRATION_ROLE_KEY` ou
`member`) e criar um menu de location "Cabeçalho (header)" em `/admin/cms/menus`. Depois do
deploy, clicar em **"Otimizar imagens antigas"** em `/admin/media` pra gerar as cópias
redimensionadas das imagens já enviadas (migration `0053` roda sozinha no build). A migration
`0054` (`themes.theme_config_revisions`, rascunho/histórico de tema) também roda no build; sem ela
o site renderiza normal e só o rascunho/histórico ficam indisponíveis. A config de tema atual é
convertida sozinha (lida das chaves 7.x) até a primeira publicação. As migrations `0055` (coluna
de mídia restrita perdida) e `0056` (schema `speech`) também rodam no build; a leitura em voz alta
nasce desligada — para usar de graça: `SPEECH_DRIVER=worker` no projeto e ligar em
**Editorial → Áudios** (`/admin/speech`; `docs/speech/leitura-em-voz-alta.md`). As migrations
`0057`/`0058` (origem de cada scope, andamento da faixa e sinal de vida do worker) também rodam no
build. Recomendado no modo worker: `SPEECH_WORKER_GITHUB_TOKEN` (o app chama o worker na hora).

### Added

- **Painel de áudios e produção visível** (`/admin/speech`, Editorial → **Áudios**): a
  configuração da leitura em voz alta sai de `/admin/settings` e ganha a fila — uma linha por
  conteúdo com título e link do editor (`source` no `syncSpeechAudio`), barra de produção com as
  faixas prontas e o percentual da faixa em geração, falhas com o último erro e "Tentar de novo",
  e o que o worker está fazendo (preparando as vozes, gerando, parado, sem sinal) mais a execução
  recente no GitHub. Atualiza sozinho enquanto há fila. A mesma barra aparece na edição da entry
  e da obra do `novels` 0.5.0. O worker gera uma faixa por vez, em trechos, informando percentual
  e fase (`/api/speech/worker/clips/<id>/progress`, `/api/speech/worker/heartbeat`). Com
  `SPEECH_WORKER_GITHUB_TOKEN` o app dispara o worker (`workflow_dispatch`) assim que algo entra
  na fila e mostra **"Gerar agora"** — o `schedule` do GitHub atrasa horas. Salvar/publicar uma
  entry já enfileira o áudio (antes só no cron). `cron.yml` e o worker falham com erro quando o
  secret `CRON_TARGETS` não é JSON válido (antes passavam em silêncio). SDK:
  `getSpeechProgress`, `getSpeechWorkerActivity`; `CORE_VERSION` 2.2.0.
  Leitura mais fluida no worker: trechos que terminam em fim de frase (sem cortar a entonação
  nem perder palavras no limite de fonemas da Kokoro), pausas fixas entre frases e parágrafos,
  bordas aparadas, volume igualado, fala pt-BR a 0,95, MP3 a 48 kbps, travessão de diálogo e
  aspas fora do texto lido. **"Gerar de novo"** por conteúdo no painel refaz o áudio com a voz e
  o worker atuais.
  Áudio do `novels` (0.6.0) por ação explícita: salvar, publicar ou editar cenas não gera nem
  refaz áudio; o bloco Áudio da obra mostra faixas em dia, desatualizadas (o áudio antigo continua
  tocando) e faltando, com **Gerar o que falta**, **Gerar tudo de novo** e **Apagar áudio**. SDK:
  `getSpeechState`, `regenerate` no `syncSpeechAudio`; `CORE_VERSION` 2.3.0.

- **Leitura em voz alta** (`contexts/speech`, `docs/speech/leitura-em-voz-alta.md`): o áudio de
  cada texto que o autor escolheu (opção "Gerar áudio" na edição da entry e da obra do `novels`,
  desligada por padrão) é gerado uma vez depois de publicado e guardado como MP3 público na mídia;
  ouvir não gera de novo. Provedor por `SPEECH_DRIVER`: **`worker`** (grátis — `.github/workflows/speech-worker.yml`
  gera com os modelos abertos Kokoro e Piper no GitHub Actions e devolve por `/api/speech/worker`,
  autenticado com `CRON_SECRET`) ou `google` (Google Cloud TTS, Chirp 3 HD). Entries públicas do
  CMS ganham o player "Ouvir este texto" (reconciliação pelo job `speech.sync-cms-entries`); plugins
  usam `@venore/plugin-sdk/speech` (`syncSpeechAudio`, `getSpeechAudio`) — o `novels` 0.4.0 lê cada
  cena. Fila com reserva atômica (duas sínteses nunca pegam a mesma faixa), **teto mensal de
  caracteres** checado antes de cada síntese, texto igual não gera de novo e texto trocado apaga o
  MP3 antigo na hora. `/admin/settings` liga/desliga, escolhe a voz e o teto e mostra o uso do mês.
  `CORE_VERSION` vai a 2.1.0 (SDK novo; faixas `>=2.0.0` continuam valendo).

- **Instâncias sem branch** (AGENTS.md §8): `main` é o único branch de deploy. O `package.json`
  declara a união dos pacotes `@venore/plugin-*`/`@venore/theme-*` (uma versão por pacote) e cada
  instância escolhe um subconjunto em `instances/<nome>.json`, selecionado pela env
  `VENORE_INSTANCE` (vazia = "venore vanilla", tudo junto). Codegen de plugins/temas e
  `test:plugins` filtram pela instância (`scripts/lib/instance-packages.ts`); job `instances` no
  CI. Instâncias migradas: `broadcast-fem`, `erasto-league`, `graphic-novels`, `nestpro`,
  `portal-colaborador`. **Na Vercel:** branch de produção `main` + `VENORE_INSTANCE=<nome>` em
  cada projeto. Versões unificadas: `nestpro` sobe `@venore/plugin-disc` 0.1.1 → 0.2.0 e
  `@venore/theme-nestpro` para v0.2.1; temas cujos repositórios foram apagados (halo, nebula,
  nimbus, paladins, vega) saem de `graphic-novels`/`nestpro`/`portal-colaborador`.

- **Contrato de tema 8.0.0** (`docs/themes/theme-system-v8.md`). O `venore-slime` virou o kit
  (`src/theme-sdk/kit`): regiões substituíveis com fallback, layouts `topbar`/`rail`, navegação
  mobile drawer/bottom-bar/tela cheia, templates e estados de página, catálogos pt-BR/en/es/ar e
  RTL. Tema v8 declara só o que difere (`defineTheme`), com tokens por região, opções no
  manifesto, fontes curadas, herança (`extends`, até 3 níveis), variantes de bloco, estilos de
  seção e layout por página no page builder. `/admin/themes/customize` edita rascunho com preview
  ao vivo, publica, mostra histórico com rollback e exporta/importa; seções do site podem trocar
  tema/layout por prefixo. Safe mode (`/api/themes/safe-mode`) e `THEME_FORCE_FALLBACK`.
  Galeria viva em `/admin/themes/gallery` e gate de CI (`npm run theme:check`: contrato de
  tokens, contraste por região, orçamento, harness SSR e Playwright com axe a 390/1280 px).
  Os 12 pacotes 7.x continuam funcionando sem mudança.

- **Mídia restrita de verdade** (migration `0054`, coluna `media.assets.access_permission`). Um
  plugin declara em `manifest.restrictedUploadCategories` quais das suas categorias guardam dado
  sensível e qual permission dá acesso (ex: currículos do `vagas` → `vagas.applications.review`).
  Esses arquivos só são lidos pelo superadmin, pelo dono e por quem tem a permission — **quem só
  tem `media.manage` não vê, não lista e não muda a visibilidade** (antes um admin do site abria
  currículo pela biblioteca de mídia). A regra vale também para os arquivos já enviados: o
  `prebuild` e o `db:update` aplicam a restrição retroativamente.
- **Driver de storage `s3`** (`MEDIA_STORAGE_DRIVER=s3`): Amazon S3 ou compatível (MinIO, R2),
  com credencial por chave ou pelo role da AWS, bucket privado por padrão e upload de arquivo
  grande direto do browser por presigned POST (tamanho e tipo travados no próprio S3). Os
  formulários de upload deixaram de depender do cliente do Vercel Blob. Configuração, CORS e IAM:
  `docs/media/s3-storage.md`.
- **Variantes de imagem no MMS** (`media.asset_variants`, `contexts/media/image-variants.ts`):
  todo upload de JPEG/PNG/WebP gera cópias WebP em 160/480/960/1920 px (nunca ampliando) e grava
  as dimensões reais do original. O original não muda. `getMediaAsset`/`listMediaAssets` trazem
  `variants`; `pickMediaVariantUrl(asset, larguraNaTela)`, `buildMediaSrcSet(asset)` e
  `getMediaAssetUrls({ ids, displayWidth })` escolhem a cópia (também no
  `@venore/plugin-sdk/media`). Asset não público serve a variante por
  `/api/media/asset/<id>?w=<largura>`. Purge apaga as variantes e a reconciliação de órfãos não
  as trata como órfãs. Motivo: fotos de 2–8 MB eram servidas cruas em avatar/card, e a cota de
  transferência do Blob no Hobby estourava.

- **Cron pelo GitHub Actions** (`.github/workflows/cron.yml`): chama `/api/cron/tick` de cada
  instância a cada 5 min — o plano Hobby da Vercel só permite cron diário. Configure o secret
  `CRON_TARGETS` no repositório e a env `CRON_SECRET` em cada projeto da Vercel.
- **Bloco Markdown** (`core.content.markdown`, GFM: tabelas, listas de tarefa, tachado). HTML cru
  vira texto e links `javascript:` são neutralizados.
- **Papel padrão de novas contas em `/admin/settings`** (setting `auth.registration_default_role`).
  Só aparece para quem gerencia papéis, e só oferece papéis que a pessoa poderia conceder.
- **Navegação do cabeçalho** vem do menu de location `header` do CMS (antes era sempre vazia).
- **Editar o escopo de um menu contextual** em `/admin/cms/menus` (antes só dava para criar).
- **Permission por namespace para settings de plugin (G5):** uma setting `<plugin>.*` também pode
  ser gravada com `<plugin>.settings.manage`, se o plugin declarar essa permission.

### Fixed

- **Coluna `media.assets.access_permission` faltando em banco novo** (migration `0055`, roda
  sozinha no build). O merge do PR #8 tirou a `0054_media_access_permission` do
  `_journal.json` (duas migrations 0054 colidiram), então banco criado ou atualizado depois disso
  ficava sem a coluna: consultas de mídia falhavam e o prebuild avisava "não deu pra aplicar a
  mídia restrita". A `0055` usa `ADD COLUMN IF NOT EXISTS` e não muda nada em banco que já tinha
  aplicado a 0054 antiga.
- **Page-builder gravava o texto de um bloco em outro**: ao trocar de bloco com campo de rich
  text de mesmo nome, o editor continuava mostrando o conteúdo do bloco anterior e a edição
  seguinte o salvava no bloco novo. Texto legado (string) também abria vazio e era apagado na
  primeira edição.
- **Salvar a composição de uma página publicada não atualizava o site** por até 60 s (cache da
  página e dos menus não era invalidado).
- **Cor de borda dos utilitários Tailwind era ignorada no app inteiro.** O reset
  `* { border-color }` de `globals.css` ficava fora de `@layer` e vencia `border-transparent`,
  `border-destructive`, `border-ring` etc. — botões shadcn ganhavam borda visível e campo inválido
  não ficava vermelho, em todos os temas. Movido para `@layer base`, com `var(--border)`.
  **Visual muda em todos os temas** onde havia cor de borda declarada.
- **Contrato de tokens agora cobre os temas em pacote** (`@venore/theme-*`), não só `src/themes/`.
- **Classes Tailwind usadas só dentro de um pacote de tema não eram geradas.** O `@import` do
  `theme.css` não faz o Tailwind ler os componentes do pacote; `gen-theme-registry.ts` agora emite
  um `@source` por tema (como já fazia para plugin). Ex: a borda do modo admin no Aurora.
- **Preset de paleta escrito à mão perdia os próprios tokens ao ser aplicado.** O gerador só
  completa o que o preset não declara — o "Oceano" do Aurora mantém o accent no mesmo matiz.
- **"Esconder o link de Entrar" funcionava só no Venore Slime.** O core também desliga a userbar
  do visitante deslogado (todos os temas respeitam), tira "Entrar" dos menus de exemplo (sidebar e
  rodapé sem menu configurado) e os 13 temas `@venore/theme-*` ganharam suporte a
  `showLoginLink`/`loginLinkHref` — `package.json` atualizado (academy 1.1.4, aurora 0.1.9,
  druids 2.0.2, fearless 1.1.3, halo 0.1.5, knights 2.0.2, nebula 0.1.5, nimbus 0.1.2, nite 2.0.2,
  paladins 2.0.2, sorcerers 2.0.2, vega 0.1.5, volt 0.1.2). Cada repositório de tema agora cria a
  tag `vX.Y.Z` sozinho quando a versão do `package.json` muda no `master`
  (`.github/workflows/tag-release.yml`).
- **Setting salva em `/admin` demorava até 5 min para valer nas outras instâncias** (cache por
  processo). Agora a invalidação é propagada via `platform.cache_versions` em até 5 s.
- **Um INSERT por setting em toda página:** `registerDefaultSetting` vai ao banco uma vez por chave
  por processo.
- **Desinstalar plugin com limpeza de banco deixava as settings apagadas no cache.**
- **Aprovar cadastro com papel padrão inexistente deixava a conta aprovada sem papel** — o papel é
  resolvido antes da aprovação. `superadmin` nunca é aceito como papel padrão.

### Security

- **JSON-LD do breadcrumb dos temas 7.x passa a ser renderizado pelo core** (escapado,
  `serializeJsonLd`): fecha uma XSS presente em 12 pacotes. O Shell 7.x recebe
  `breadcrumbsJsonLd: null`. Headers `x-venore-theme-*` vindos de fora são descartados no proxy.
- `dompurify` 3.4.16, `undici` 6.29.0/7.30.0 (alerta alto, via `@vercel/blob`), `ip-address`
  10.7.2 e `vitest` 4.1.11. Resta o `esbuild` antigo do `@esbuild-kit` (via `drizzle-kit`), que só
  afeta o dev server do esbuild — não usado.

### Docs

- `AGENTS.md`, `docs/venore-docks.md`, `docs/issues.md`, roadmap, `docs/media/*` e o plano de temas
  alinhados ao código (plugins fora do core, migrations de plugin no build, SVG e auth por asset na
  mídia). Situação por bloco em `docs/page-builder-blocos-planejados.md`.

## [0.6.0] - 2026-09-27

Avaliação do core (`docs/melhorias-e-recursos.md`): correções de segurança P0–P3 e os recursos que
faltavam. **Atenção ao atualizar uma instância:**

- O "primeiro cadastro vira superadmin" não existe mais — use `SETUP_TOKEN` + `/setup` ou
  `npm run db:install:fresh`.
- Contas novas nascem `pending`; revise a setting de aprovação em `/admin/settings`.
- Migrations 0042–0052 rodam no build. A 0047 cria um índice único em `lower(email)` e **não** o
  cria (só avisa) se houver e-mails duplicados por maiúsculas/minúsculas.
- Configure `CRON_SECRET` + um cron em `/api/cron/tick` (serverless) e, se quiser e-mail,
  `EMAIL_DRIVER`. Todas as variáveis estão em `.env.example`.
- `@venore/plugin-sdk/auth`, `/rbac` e `/media` passaram a exportar uma lista explícita — os
  plugins oficiais usam só o que ficou.

### Security

- **Hierarquia do RBAC aplicada no servidor.** Quem não é superadmin não concede nem remove o papel
  `superadmin`, não mexe nos papéis de um superadmin e não concede (a um papel ou via papel) uma
  permission que ele mesmo não tem (`contexts/rbac/shared/privilege-guard.ts`). Ações sobre outro
  usuário (congelar, descongelar, remover, apagar, redefinir senha) passam por
  `authorizeActorOverUser`: só superadmin age sobre superadmin e ninguém congela/remove/apaga a
  própria conta. Antes, o papel `admin` conseguia se promover a superadmin pela própria tela.
- **XSS armazenado via JSON-LD do breadcrumb.** O `venore-slime` serializa com `serializeJsonLd`
  (escapa `<`, `>` e `&`; exportado em `@venore/theme-sdk/json-ld` para os demais temas) e o core
  neutraliza `<`/`>` nos rótulos do JSON-LD na origem, protegendo também os temas externos que
  ainda usam `JSON.stringify` cru.
- **`installPlugin` autoriza antes de agir.** Migrations e concessão de permissions ao `admin`
  rodavam antes da única checagem de `platform.extensions.manage`.
- **Atualização de tema sem injeção no `package.json`.** A tag precisa ser semver e existir no
  repositório do tema; `package.json` e `package-lock.json` são reescritos estruturadamente e
  commitados juntos (um commit, fast-forward) via Git Data API.
- **Primeiro superadmin só com `SETUP_TOKEN`.** O "próximo cadastro vira superadmin" (anunciado na
  tela de login) deixava uma instância recém-publicada ser tomada por quem chegasse primeiro. Agora
  o `/setup` exige o token da variável de ambiente `SETUP_TOKEN` (16+ caracteres) — cria a conta
  ou promove a conta logada — ou use `npm run db:install:fresh` / `db:bootstrap-superadmin`.
- **Cadastro fail-closed.** `auth.users.status` nasce `pending` (migration 0042); a conta só vira
  `approved` por decisão explícita (aprovação, admin, instalador, setup, ou aprovação desligada via
  `activateUser`). Nova setting "Permitir que visitantes criem conta" (`/admin/settings`) fecha o
  autocadastro — formulário e primeiro login OAuth. A Server Action de cadastro recusa quando o
  login por senha está desligado.
- **Login sem enumeração de contas.** O status da conta (pendente, congelada...) só aparece depois
  da senha correta (`BlockedAccountError` no `authorize`); e-mail inexistente gasta o mesmo tempo
  de verificação; "e-mail já cadastrado" responde como cadastro recebido; `?error=` da tela de
  login só aceita códigos conhecidos (antes exibia texto livre da URL).
- **Senhas com scrypt N=2^15, r=8, p=3** (formato `scrypt2$…` com parâmetros no hash); hashes
  antigos seguem válidos e são regravados no próximo login.
- **Rate limit persistente (Postgres)** — login (por IP e por e-mail), cadastro, setup, upload,
  feed de conteúdo e relatório de CSP. IP vem de `x-vercel-forwarded-for` / `x-real-ip` / último
  hop do `x-forwarded-for` (o primeiro hop era falsificável).
- **Headers de segurança.** `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
  HSTS (produção) e `X-Frame-Options` em todas as respostas; CSP com nonce por request no
  `proxy.ts` — `frame-ancestors`/`object-src`/`base-uri` sempre aplicados, política completa em
  `CSP_MODE=report-only` (default; violações vão pra `/api/csp-report` e aparecem em
  `/admin/diagnostics`), `enforce` ou `off`. `FRAME_ANCESTORS` libera iframes de outros sites.
- **Mídia privada de verdade.** Asset não público é servido por `/api/media/asset/[id]` com
  autorização por asset (dono, `media.manage` ou URL assinada de curta duração); a rota do driver
  filesystem aplica a mesma regra e faz streaming com `Range`. `getMediaAssetForTrustedReview`
  devolve URL assinada. Migration 0044 troca a URL dos assets não públicos existentes.
  `MEDIA_BLOB_ACCESS=private` usa um Blob Store privado (nada acessível pela URL do storage).
- **Upload direto verificado no storage.** O registro confere o objeto (`storagePort.stat`) e
  usa tamanho/tipo reais; a URL informada pelo cliente é ignorada (antes dava pra registrar URL
  arbitrária, que o export baixava no servidor); checksum informado pelo browser não deduplica.
- **SVG servido com CSP `sandbox`** e `nosniff` pelas rotas de mídia.
- **Import de pacote autoriza antes de ler o corpo** e recusa `Content-Length` ausente (411) ou
  acima de 256 MB (413); o .zip tem teto de arquivos e de tamanho descomprimido declarado (um
  zip-bomba é recusado sem descomprimir).
- **Tipo do arquivo conferido pelos bytes** (PNG, JPEG, GIF, WebP, SVG, PDF, MP4, WebM, MP3, WAV,
  OGG) no upload pelo servidor e no registro do upload direto — HTML ou executável rotulado como
  imagem é recusado.
- **Push só para os serviços dos navegadores.** Endpoint de inscrição precisa ser `https` em FCM,
  Mozilla, Apple ou WNS (`WEB_PUSH_EXTRA_HOSTS` acrescenta outros); inscrição fora da lista nunca é
  chamada e é apagada no envio (antes o servidor fazia POST em qualquer URL cadastrada).
- **Permissões revogadas valem em todas as instâncias em até 5 s.** O cache de papéis por usuário
  fica em `globalThis` e é invalidado entre instâncias por um contador em
  `platform.cache_versions` (migration 0046); antes um papel removido seguia valendo até 5 min.
- **SDK de plugin com lista explícita de exports.** `@venore/plugin-sdk/auth` e `/rbac` deixam de
  reexportar o barrel inteiro: saem `activateUser`, `provisionUser`, `registerWithPassword`,
  `grantSuperadmin`, gestão de papéis e o fluxo do Auth.js; `findUserByEmail` do SDK não devolve
  mais o hash da senha; `/media` perde os primitivos de sistema da lixeira. Todos os plugins
  oficiais usam só o que ficou. O despachante de `/admin/<plugin>` exige sessão com acesso ao
  admin antes de resolver a rota, mesmo que o plugin esqueça o próprio gate.
- **Dependências:** `next` 16.2.11 → 16.3.6 (advisories crítico/altos), Tiptap 3.29 → 3.31 e
  transitivas (`js-yaml`, `nanoid`, `brace-expansion`, `fast-uri`, `hono`, `qs`). Restam 4
  moderadas no `esbuild` interno do `drizzle-kit` (só servidor de dev do esbuild, não usado) e 2
  no `vitest` (runner de teste; a correção 4.1.11 esbarra num bug do npm ao resolver peers
  opcionais — pendente).

### Added

- **Convites:** em `/admin/community`, quem tem `rbac.users.manage` convida por e-mail com um papel
  (mesmas travas de atribuir papel); o link `/convite/<token>` (7 dias, uso único) cria a conta já
  aprovada — funciona com o autocadastro fechado. Sem e-mail configurado, o link aparece para
  copiar. Convites pendentes listados e canceláveis (migration 0052).
- **Bloco "Formulário de contato":** mensagem enviada por e-mail (`EMAIL_DRIVER`) com responder-para
  o visitante; destinatário cifrado no token (não aparece no HTML nem pode ser trocado), honeypot,
  limite por IP e Cloudflare Turnstile opcional (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` +
  `TURNSTILE_SECRET_KEY`).
- **Blocos novos no page builder:** Vídeo/incorporação (YouTube, Vimeo, Google Maps, Spotify —
  só provedores conhecidos viram iframe), Tabela, Arquivo para download (novo campo de mídia
  "file"), Perguntas frequentes (com JSON-LD `FAQPage`), Código, Números em destaque e Linha do
  tempo.
- **Backup diário cifrado** (`.github/workflows/backup.yml`): `pg_dump` de cada instância listada
  no secret `BACKUP_TARGETS`, cifrado com GPG AES-256 (`BACKUP_PASSPHRASE`) antes de virar
  artifact (14 dias). Configuração e restauração em `docs/backup.md`.
- **LGPD (autoatendimento) em `/account`:** "Baixar meus dados" (`/api/account/export`, JSON com
  perfil, papéis, arquivos enviados e conteúdos de autoria — nunca senha/segredo) e "Excluir minha
  conta" (confirma e-mail e senha; anonimiza como a remoção pelo admin; superadmin não se exclui).
- **Verificação em duas etapas (TOTP)** no login por senha: ativação em `/account` com QR code e 8
  códigos de recuperação (uso único), código exigido só depois da senha certa, código não vale duas
  vezes, desativação exige um código válido e o admin pode redefinir (`/admin/community`). Segredo
  cifrado com AES-256-GCM derivado do `AUTH_SECRET` (migration 0051).
- **Busca pública** em `/busca` (Postgres full-text): título pesa mais que o corpo, acha com e sem
  acento, só conteúdo publicado (e "authenticated" só pra quem está logado), paginada e com limite
  por IP. Coluna gerada + índice GIN (migration custom 0050, fora do schema Drizzle).
- **Link de pré-visualização de rascunho** no editor do conteúdo: link assinado (1, 3 ou 7 dias)
  em `/visualizar-rascunho/<token>` mostra a versão atual pra quem não tem conta; noindex.
- **E-mail (provedor plugável)** em `src/infrastructure/email`: `EMAIL_DRIVER=resend`
  (`RESEND_API_KEY`, `EMAIL_FROM`), `console` (dev) ou desligado.
- **Recuperação de senha:** "Esqueci minha senha" no `/login` (só com e-mail configurado),
  `/forgot-password` e `/reset-password`. Link de uso único, 1 hora, só o hash no banco
  (migration 0049), resposta igual exista ou não a conta, limite por IP e por e-mail, sessões
  antigas derrubadas. Tokens vencidos saem pelo agendador.
- **Aviso de cadastro pendente:** com aprovação exigida, quem tem `rbac.users.manage` (e todo
  superadmin) recebe um e-mail com o link de `/admin/community`.
- **Sessões revogáveis.** "Sair dos outros dispositivos" em `/account` e "Encerrar sessões" no
  perfil do usuário em `/admin/community`; trocar a senha (própria ou pelo admin) também derruba
  as sessões abertas. O JWT guarda `users.session_version` (migration 0048) e a sessão atual é
  renovada só com prova assinada pelo servidor.
- **Troca de senha em `/account`**, exigindo a senha atual quando a conta já tem uma.
- **SEO:** `<title>`, description (primeiro parágrafo), canonical e Open Graph (capa) por
  conteúdo e categoria; `sitemap.xml`, `robots.txt` (preview não indexa) e RSS em `/rss.xml`
  (`?category=`). Conteúdo "authenticated" fica fora de tudo isso. `SITE_URL` define o domínio.
- **Saúde e erros:** `GET /api/health` (app + banco, 200/503) e `src/instrumentation.ts`
  (`onRequestError`) registrando erros não tratados em `/admin/diagnostics` e, com
  `ERROR_WEBHOOK_URL`, enviando pra um webhook.
- **Revisões e propostas no CMS.** Cada alteração guarda o estado anterior (histórico restaurável,
  50 por conteúdo). Quem não pode publicar (papel `author`) ao editar um conteúdo publicado cria
  uma **proposta** — o site não muda até alguém com `cms.entries.publish` aplicar. Arquivar
  conteúdo publicado também exige publicar. Tela "Histórico e propostas" no conteúdo.
- **Agendador de tarefas** (`platform/scheduled-jobs`): `/api/cron/tick` protegido por
  `CRON_SECRET` roda publicação agendada, flush de logs/visualizações, retenção, reconciliação de
  mídia e limpeza do rate limit, com lock no banco (uma execução por vez entre instâncias).
  Plugins declaram `scheduledJobs` em `contributions.ts`. Em serverless, logs e visualizações
  também são gravados logo após a resposta (`waitUntil`). `IN_PROCESS_JOBS=false` desliga os
  timers em processo.
- **Paginação** no blogroll (`?page=`, 12 por página), em `/admin/cms/entries` (50 por página,
  busca/status/tag filtrados no banco pela URL) e em `/admin/media` (60 por página).
- `getMediaAssetUrls` (media) — URLs de vários assets numa consulta, com a mesma regra de
  visibilidade de `getMediaAsset`.
- **Login volta pra página de origem** (`?callbackUrl=`, só caminho relativo da própria origem) e
  telas próprias do Auth.js (`pages.signIn`/`pages.error` → `/login`, erros OAuth em português).

- **Migrations fora do preview.** O `prebuild` usa `scripts/migrate-on-build.mjs`: em preview da
  Vercel não migra (a não ser com `MIGRATE_ON_PREVIEW=true`); `SKIP_DB_MIGRATIONS=true` pula
  sempre. Guia de migrations compatíveis em `docs/migrations-guia.md`.
- **CI em todo branch** (inclusive instância, quando receber este merge), job `plugins`
  (`test:plugins` com os pacotes instalados), job `e2e` (Playwright: setup + login) e teste que
  chama toda Server Action sem sessão e falha se ela gravar algo
  (`src/app/server-actions-authorization.test.ts`). Teste de integração do fluxo de cadastro.
- `.env.example` versionado com todas as variáveis; README e AGENTS.md atualizados.

### Fixed

- `getMediaUsageSummaryAction` (onde uma mídia é usada) respondia a qualquer visitante — agora
  exige `media.manage`.
- **Export do site funciona com mídia privada e com o driver filesystem.** Os arquivos são lidos
  pelo storage (antes: `fetch` da URL, relativa nesses casos); leitura com concorrência limitada e
  arquivo que falha fica de fora com o motivo em `manifest.skippedAssets` (header
  `X-Export-Skipped-Assets`) em vez de derrubar o export inteiro.
- **Blogroll sem N+1:** uma consulta pras entries da página, uma pras capas; o resumo sai do
  `data` já carregado (antes eram duas consultas por card, mais sessão/RBAC por capa).
- **Índices** em `cms.entries` (categoria+status+publicação, agendamentos, autor) e
  `rbac.user_roles(role_id)`; **e-mail único sem diferenciar maiúsculas**
  (`users_email_lower_idx`, migration 0047 — se já houver duplicatas o índice não é criado e o
  Postgres registra um WARNING; resolva e crie à mão) e busca por e-mail com `lower()`.
- **Pool do Postgres com limites:** `max` 5 na Vercel / 10 fora (`DATABASE_POOL_MAX`), timeout de
  conexão de 10 s e `statement_timeout` de 30 s só no runtime do Next
  (`DATABASE_STATEMENT_TIMEOUT_MS`; migrations via script ficam sem limite).
- Usuário OAuth pendente caía em `/login` sem explicação depois de entrar — agora vai pra
  `/pending-approval`.
- Driver de mídia padrão (em memória) em produção sem `MEDIA_STORAGE_DRIVER` agora falha no upload
  em vez de perder o arquivo no próximo reinício.

### Removed

- Atalho `AUTH_ENABLE_DEV_CREDENTIALS` (qualquer usuário/senha em dev): não funcionava (o id
  `dev-*` não existe no banco) — use `npm run db:install:fresh`.

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
