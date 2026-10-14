# Known Gaps

Lista geral de lacunas conhecidas, derivada da leitura do código (antes era a §7 do `AGENTS.md`).
Itens resolvidos saem desta lista — o registro deles fica no `CHANGELOG.md` e no histórico do git.

`docs/issues.md` reúne pedidos/lacunas registrados durante sessões específicas (ex: plugin
`birthdays`), com o contexto de por que ficaram de fora e do que dependem para retomar. Este arquivo
continua sendo a lista geral, derivada da leitura do código:

- **Radius/espaçamento sem enforcement mecânico.** O contrato de tokens proíbe `rounded-lg`/`p-3`
  hardcoded, mas `eslint.config.mjs` só tem `no-restricted-syntax` para cor. Nada bloqueia
  raio/espaçamento cru hoje.
- **Auditoria parcial.** Auditoria de
  ações sensíveis existe desde a sessão do log de eventos legível (`src/observability/audit-log.ts`
  + tabela `audit.security_audit_events`), mas só é chamada explicitamente pelas ações já
  migradas (ver `src/observability/features/clear-events/service.ts` e os `service.ts` apontados
  no comentário de `src/observability/origin-registry.ts`); a maioria das ~130 outras chamadas de
  `beginOperation`/`endOperation` no projeto ainda só gera log operacional, não auditoria — expandir
  a lista de ações que chamam `recordAuditEvent` é trabalho incremental, não builtin automático.
- **Pendências da avaliação de 27/09/2026** (detalhe em `docs/melhorias-e-recursos.md`, seção
  "Situação da implementação"): cache de página pública (layout depende da sessão), lint de
  fronteira nos repositórios dos plugins, imagens otimizadas, i18n, webhooks/tokens de API,
  consentimento de cookies e retenção de uploads anônimos.
- **`db` exposto no SDK de plugin — possibilidade futura, não urgente** (decisão de 2026-09-30).
  Plugin guarda id de usuário como coluna simples (sem FK entre schemas) e lê dados de outro
  domínio só pelo SDK/barrel de outro plugin; o `db` compartilhado permite, por erro, ler/escrever
  fora do próprio schema. Isolar de verdade (um role Postgres por plugin, com GRANT só no schema
  dele) custa um pool de conexão por plugin e provisionamento no Neon — só compensa se plugins de
  terceiros passarem a ser aceitos. Até lá, a proteção é o lint de fronteira + revisão.
- **Docs com trechos anteriores à saída dos plugins do core (2026-09-02) e à 0.6.0** (levantado
  em 2026-09-30, conferido contra o código):
  - `docs/implementation-roadmap.md` e `docs/issues.md` descrevem plugins (academy, birthdays,
    broadcast…) como se morassem em `src/plugins/`; o código deles está nos repositórios
    `venore-plugin-*`, instalados como pacote (seção 8). Fase 7 (Academy) e IE2 do roadmap pertencem
    a esses repositórios, não ao core.
  - Roadmap: agendamento/flush descritos com `setInterval` em processo — hoje é
    `/api/cron/tick` + `platform/scheduled-jobs` (o `setInterval` só sobra em self-host, via
    `IN_PROCESS_JOBS`). P3 ("quem tem `cms.entries.manage` continua publicando") foi revogado
    pela D6 de `docs/rbac-scoped-roles.md`.
  - `docs/themes/temas-como-pacotes-plano.md` (status "não iniciado", 7 temas) descreve estado
    anterior ao atual — os temas extras já são pacotes `@venore/theme-*` e o contrato vigente é o
    8.0.0 (`docs/themes/theme-system-v8.md`, seção 3).
  - `docs/melhorias-e-recursos.md` pede scrypt N=2^17; o implementado é N=2^15
    (`password-hashing.ts`, CHANGELOG 0.6.0).
- **Temas v8 — lacunas conhecidas** (detalhe em `docs/themes/theme-system-v8.md`):
  - Navegação soft não remonta o `(platform)/layout`: largura, rail (a partir de lg) e barra
    contextual "none" seguem a página atual pelo CSS de marcadores, mas barra contextual `top` ×
    `side`, troca de tema por seção e o botão de colapso no header só mudam num reload.
  - Os Shells dos pacotes 7.x têm dívida de axe/teclado e, na maioria, estouram 390 px com 3+
    links no header (`e2e-themes/a11y-baseline.json`) — some quando cada pacote migrar para 8.0.
  - Sweep de mídia (cron, sem sessão) só protege a mídia referenciada na config **publicada**; a
    do rascunho exige expor uma leitura sem autorização do context `themes` para `platform/`.
  - Testes de integração de `theme-config-lifecycle` e `entry-layout` só rodam no job
    `integration` do CI (`TEST_DATABASE_URL`).
- **Feed de notícias entre sites (`contexts/content-feed`) não funciona ponta a ponta**: sem sync
  automático, sem exibição no assinante, sem propagar despublicação, cursor no relógio do
  assinante. Plano em `docs/content-feed-implementacao.md` (2026-10-01), não iniciado.
- **Estratégia de teste por camada não documentada** além do que a seção 5/6 deste arquivo já
  descreve — o documento de arquitetura lista isso como não coberto.
- **Plugin `birthdays` — escopo de `settings.manage`, impressão/identidade visual e importação
  CSV** ficaram fora da sessão que criou o plugin (ativação/desativação já foi resolvida pelo G1;
  o block `birthdays-month-list` já foi implementado e revisado — ver `docs/issues.md` G6). O
  plugin mora hoje em repositório próprio; detalhado com contexto e dependências em
  `docs/issues.md`.
