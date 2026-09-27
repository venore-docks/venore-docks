# Venore Docks — Melhorias e recursos faltantes

27/09/2026 · Adoniran Bail

## Contexto

São 21 melhorias e 20 recursos. As 5 melhorias P0 fecham falhas de segurança e cabem em poucos dias de trabalho. Tudo veio da avaliação do `main` feita em 26/09/2026 (commit `10d39c2`). Lint, typecheck e os 973 testes unitários passam; os problemas estão em lógica e arquitetura.

- **P0**: falha de segurança explorável hoje; corrigir antes do próximo deploy.
- **P1**: risco alto ou bug que afeta produção.
- **P2**: correção importante, sem urgência imediata.
- **P3**: qualidade, processo e documentação.

Os custos de cada item estão em [custos-melhorias-e-recursos.md](custos-melhorias-e-recursos.md).

## Sugestões de melhorias

| # | Prioridade | Melhoria | O que resolve | Esforço |
| --- | --- | --- | --- | --- |
| 1 | P0 | No service, só superadmin atribui/remove `superadmin`, redefine senha ou congela superadmin; ninguém concede permissão que não tem | Admin consegue virar superadmin | Baixo |
| 2 | P0 | Serializar o JSON-LD do breadcrumb escapando `<` (`\u003c`) + teste de regressão | XSS armazenado via título de entry/nome de arquivo | Baixo |
| 3 | P0 | `authorizeActor` na primeira linha de `installPlugin`; tirar `grantPermissionsToRole` do barrel público | Migrations e concessão de permissões sem autorização | Baixo |
| 4 | P0 | Validar `targetTag` contra as tags reais; editar o `package.json` via `JSON.parse`/`stringify`; atualizar o lockfile | Injeção no `package.json` e lock divergente | Baixo |
| 5 | P0 | Atualizar `next` para 16.3.6+, `npm audit fix`, Dependabot/Renovate | 1 vulnerabilidade crítica e 7 altas | Baixo |
| 6 | P1 | Bootstrap de superadmin só com `SETUP_TOKEN` ou via CLI; tirar o aviso público do login | Instância nova pode ser tomada | Baixo |
| 7 | P1 | Rate limit persistente em login, cadastro, senha, upload anônimo e feed; IP de fonte confiável; descarte de chaves antigas | Força bruta, spam de cadastro, vazamento de memória | Médio |
| 8 | P1 | Status padrão `pending`, cadastro em transação, checar se senha está habilitada no signUp, mensagens de login genéricas, scrypt 2^17 com rehash | Cadastro fail-open e enumeração de contas | Baixo |
| 9 | P1 | Headers de segurança: CSP com nonce, `frame-ancestors`, HSTS, `nosniff`, `Referrer-Policy` | Clickjacking e falta de defesa contra XSS | Médio |
| 10 | P1 | Cron real (Vercel Cron com `CRON_SECRET` ou pg-boss); `waitUntil` no envio de logs/views | Agendamento e logs não confiáveis em serverless | Médio |
| 11 | P1 | Mídia privada de verdade (Blob privado/URL assinada + rota com autorização); `createReadStream` no `Range`; driver padrão falhando em produção | Currículos expostos (LGPD), memória, perda silenciosa de uploads | Médio |
| 12 | P1 | Editar entry publicada gera revisão pendente; alterar publicada exige `cms.entries.publish` | Autor altera conteúdo publicado | Médio |
| 13 | P2 | Import autoriza antes de ler o arquivo e limita tamanho/descompressão; export lê via `storagePort`, com concorrência limitada e falha por item | DoS no import; export quebrado no driver filesystem | Médio |
| 14 | P2 | Registrar upload direto via `head()` do Blob; checar o tipo real pelos bytes; allowlist https dos serviços de push | SSRF e registro de URLs arbitrárias | Baixo |
| 15 | P2 | Cache de permissões em `globalThis` com versão no banco para invalidar entre instâncias | Papel removido continua valendo por até 5 min | Baixo |
| 16 | P2 | SDK de plugin com exports explícitos (sem `db`, bypass ou hash de senha); lint de fronteira nos repos de plugin; checagem de acesso no despachante de admin | Plugins com acesso irrestrito | Médio |
| 17 | P2 | Corrigir `getPostLoginDestination` (ler status antes de `getCurrentUser`) e o teste | Usuário OAuth pendente volta ao login sem aviso | Baixo |
| 18 | P2 | Paginação, índices faltantes, `unique(lower(email))`, pool com `max`/`statement_timeout`, cache de páginas públicas com `revalidateTag` | Lentidão e carga no banco conforme os dados crescem | Médio |
| 19 | P3 | Migrations como etapa de release separada ou banco isolado para Preview; guia de migrations compatíveis | Preview migrando produção; schema à frente do código | Médio |
| 20 | P3 | CI nos branches de instância com `test:plugins`; testes de integração dos fluxos cruzados; E2E com Playwright; teste que falha se Server Action não autoriza | Deploy de instância sem CI; poucos testes de integração | Médio |
| 21 | P3 | Revisar README e AGENTS.md; versionar `.env.example`; mover `TODO blocks.md` para `docs/` | Documentação desatualizada | Baixo |

Esforço: Baixo ≈ até 1 dia; Médio ≈ 2 a 5 dias de desenvolvimento.

## Recursos que faltam

| Recurso | Por que faz falta | Depende de serviço externo? |
| --- | --- | --- |
| E-mail transacional | Base para verificação de e-mail, recuperação de senha, convites e avisos de aprovação | Sim (provedor de e-mail) |
| Recuperação e troca de senha | Não há "esqueci a senha"; `setOwnPassword` existe sem tela; hoje só o admin redefine | Sim, para o e-mail de recuperação |
| Convite por link | Hoje o admin define a senha de quem entra | Sim, se o convite for por e-mail |
| MFA / passkeys | Nenhum segundo fator, nem para o superadmin | Não |
| Gestão de sessões | JWT sem revogação: faltam "sair de todos os dispositivos" e revogação ao trocar senha | Não |
| Revisões de conteúdo | Sem histórico, comparação ou rollback; editar publicada vai direto ao ar | Não |
| Preview de rascunho compartilhável | Link com token para revisar antes de publicar | Não |
| SEO do CMS | Sem title/description/Open Graph por entry, sem `sitemap.xml`, `robots.txt`, canonical ou RSS | Não |
| Busca pública | Nenhuma busca de conteúdo; Postgres FTS resolve | Não |
| Formulário de contato | Básico para site institucional, com anti-spam | Opcional (CAPTCHA; e-mail para notificar) |
| Blocos planejados | Vídeo/embed, Tabela, Arquivo, FAQ, Code/Markdown, Stats, Timeline | Não |
| Imagens otimizadas | Sem miniaturas nem `srcset`; toda imagem sai no tamanho original | Opcional (otimizador de imagem da Vercel) |
| i18n | Interface fixa em pt-BR, sem conteúdo multilíngue | Não |
| LGPD self-service | Exportar/excluir a própria conta, consentimento de cookies, retenção de uploads anônimos | Não |
| Tarefas agendadas para plugins | Plugins não têm onde agendar tarefas de forma confiável | Sim (cron da hospedagem) ou não (pg-boss no Postgres) |
| Observabilidade externa | Health check, rastreamento de erros, alertas | Sim (Sentry ou similar) |
| Backup/restore agendado | O import/export é manual e melhor-esforço | Sim (backup do Postgres e da mídia) |
| Webhooks e tokens de API | Integração com terceiros e uso headless | Não |
| Volta ao destino após login | Depois do login sempre cai em `/` ou `/admin` | Não |
| Páginas de erro de autenticação próprias | Erros de OAuth caem na página padrão do Auth.js, em inglês | Não |

## Ordem sugerida de execução

1. **Semana 1 — segurança urgente:** melhorias 1 a 5 (todas P0, esforço baixo, sem custo externo).
2. **Semanas 2 a 3 — endurecimento:** melhorias 6 a 9 e 17; em seguida o provedor de e-mail, que destrava recuperação de senha, verificação e convites.
3. **Semanas 4 a 6 — confiabilidade em produção:** melhorias 10 a 16 (cron, mídia privada, revisões no CMS, import/export).
4. **Depois — escala e produto:** melhorias 18 a 21 e os recursos de SEO, busca, formulários, blocos e i18n, conforme a demanda das instâncias.
