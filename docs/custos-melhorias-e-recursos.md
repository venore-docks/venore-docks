# Venore Docks — Custos das melhorias e recursos

27/09/2026 · Adoniran Bail

## Resumo

Dá para fazer tudo com US$ 0/mês em serviços externos numa instância pequena, usando os planos gratuitos. Com volume moderado, a conta fica em torno de **US$ 60/mês por instância**. O custo maior é desenvolvimento: cerca de **48 dias** para as 21 melhorias e **60 dias** para os 20 recursos.

- **Sem custo externo:** 17 das 21 melhorias e 13 dos 20 recursos rodam só com o que já existe (Next.js, Postgres, Vercel).
- **Com serviço externo:** e-mail, rate limit, cron, rastreamento de erros, backup, CAPTCHA e storage de mídia privada.
- **Preços aproximados**, de memória e em dólar (como os fornecedores cobram); não consultei as páginas de preço nesta sessão. Confirme antes de contratar.
- **Desenvolvimento em dias-pessoa**: multiplique pelo custo/dia do time.

## Serviços externos

O e-mail é o único serviço sem alternativa interna. Todos os outros têm opção gratuita ou podem rodar no próprio Postgres.

| Necessidade | Opção recomendada | Plano grátis | Plano pago (aprox.) | Alternativa sem custo |
| --- | --- | --- | --- | --- |
| E-mail transacional | Resend | ≈3.000 e-mails/mês (limite diário ≈100) | ≈US$ 20/mês (≈50.000 e-mails) | Amazon SES ≈US$ 0,10 por 1.000 e-mails; Brevo com ≈300/dia grátis |
| Rate limit persistente | Upstash Redis | ≈500 mil comandos/mês | ≈US$ 0,20 por 100 mil comandos | Tabela no Postgres (sem custo, mais carga no banco) |
| Cron / tarefas agendadas | Vercel Cron | Hobby: só 1x por dia | Vercel Pro ≈US$ 20/usuário/mês (frequência por minuto) | pg-boss no Postgres; cron do servidor em self-host |
| Rastreamento de erros | Sentry | ≈5.000 erros/mês, 1 usuário | Team ≈US$ 26/mês | Logs do próprio `observability` + alertas por e-mail |
| Mídia privada | Cloudflare R2 (URL assinada) | ≈10 GB armazenados | ≈US$ 0,015/GB-mês, sem taxa de saída | Driver filesystem com rota autenticada (self-host) |
| Backup do banco | Backup do provedor Postgres (Neon/Supabase) | Retenção curta | ≈US$ 19–25/mês no plano com restauração por ponto no tempo | `pg_dump` diário para o R2 (centavos/mês) |
| CAPTCHA no formulário | Cloudflare Turnstile | Grátis, sem limite prático | — | — |
| Otimização de imagens | Image Optimization da Vercel | Cota incluída no plano | Excedente cobrado por imagem | Gerar miniaturas no upload (sharp, já instalado) |
| Dependências e análise de código | Dependabot | Grátis | CodeQL em repo privado exige GitHub Advanced Security (≈US$ 30/committer/mês) | Dependabot + `npm audit` no CI |
| CI | GitHub Actions | ≈2.000 min/mês em repo privado | ≈US$ 0,008/min no Linux | — |

Para o e-mail, o provedor exige um domínio próprio com registros SPF e DKIM configurados; sem isso, as mensagens caem em spam.

## Custo por melhoria

As 5 melhorias P0 custam cerca de 4 dias e nada em serviço externo. O total das 21 fica em cerca de 48 dias.

| # | Melhoria | Desenvolvimento (dias) | Serviço externo | Custo mensal contínuo |
| --- | --- | --- | --- | --- |
| 1 | Travas de hierarquia do superadmin | 1 | Nenhum | US$ 0 |
| 2 | Escapar JSON-LD do breadcrumb | 0,5 | Nenhum | US$ 0 |
| 3 | Autorizar `installPlugin` antes de agir | 0,5 | Nenhum | US$ 0 |
| 4 | Validar `targetTag` e atualizar lockfile | 1 | Nenhum | US$ 0 |
| 5 | Atualizar `next` e dependências; Dependabot | 1 | Dependabot (grátis) | US$ 0 |
| 6 | Bootstrap de superadmin com `SETUP_TOKEN` | 1 | Nenhum | US$ 0 |
| 7 | Rate limit persistente | 3 | Upstash (ou tabela no Postgres) | US$ 0 no grátis; ≈US$ 1–10 com volume |
| 8 | Cadastro fail-closed, sem enumeração, scrypt 2^17 | 2 | Nenhum | US$ 0 |
| 9 | Headers de segurança (CSP etc.) | 3 | Nenhum | US$ 0 |
| 10 | Cron real + `waitUntil` | 3 | Vercel Pro (ou pg-boss) | US$ 0 com pg-boss; ≈US$ 20/usuário com Vercel Pro |
| 11 | Mídia privada, streaming, driver seguro | 4 | R2 ou Blob | ≈US$ 0–5 até algumas centenas de GB |
| 12 | Revisão pendente para entry publicada | 5 | Nenhum | US$ 0 |
| 13 | Import/export seguros e resilientes | 3 | Nenhum | US$ 0 |
| 14 | Upload verificado e allowlist de push | 1,5 | Nenhum | US$ 0 |
| 15 | Cache de permissões invalidável entre instâncias | 1 | Nenhum | US$ 0 |
| 16 | SDK de plugin mínimo + gate central | 4 | Nenhum | US$ 0 |
| 17 | Corrigir destino pós-login do pendente | 0,5 | Nenhum | US$ 0 |
| 18 | Paginação, índices, pool, cache público | 4 | Nenhum | US$ 0 (reduz custo de banco) |
| 19 | Migrations como etapa de release | 3 | Banco separado para Preview | ≈US$ 0–19/mês (branch de banco no Neon costuma ser grátis) |
| 20 | CI nas instâncias, integração, E2E | 5 | GitHub Actions | US$ 0 até ≈2.000 min/mês; depois ≈US$ 0,008/min |
| 21 | Documentação e `.env.example` | 1 | Nenhum | US$ 0 |
|  | **Total** | **≈48** |  | **US$ 0 a ≈US$ 55/mês** |

## Custo por recurso

O e-mail custa ≈2 dias e US$ 0 até ≈3.000 mensagens/mês; depois disso, ≈US$ 20/mês. Ele destrava três recursos da lista. O total dos 20 recursos fica em cerca de 60 dias.

| Recurso | Desenvolvimento (dias) | Serviço externo | Custo mensal contínuo |
| --- | --- | --- | --- |
| E-mail transacional | 2 | Resend, SES ou Brevo + domínio com SPF/DKIM | US$ 0 até ≈3.000/mês; ≈US$ 20 até ≈50.000; SES ≈US$ 0,10 por 1.000 |
| Recuperação e troca de senha | 2 | Usa o e-mail acima | Incluído no e-mail |
| Convite por link | 1,5 | Usa o e-mail acima | Incluído no e-mail |
| MFA / passkeys | 4 | Nenhum | US$ 0 |
| Gestão de sessões | 2 | Nenhum | US$ 0 |
| Revisões de conteúdo | 5 | Nenhum | US$ 0 (mais espaço no banco) |
| Preview de rascunho compartilhável | 1,5 | Nenhum | US$ 0 |
| SEO do CMS | 3 | Nenhum | US$ 0 |
| Busca pública (Postgres FTS) | 3 | Nenhum | US$ 0 |
| Formulário de contato | 3 | Turnstile (grátis) + e-mail para notificar | Incluído no e-mail |
| Blocos planejados | 5 | Nenhum | US$ 0 |
| Imagens otimizadas | 2 | Opcional: Image Optimization da Vercel | US$ 0 gerando miniaturas no upload; excedente da Vercel se usar o otimizador |
| i18n | 10 | Nenhum | US$ 0 |
| LGPD self-service | 4 | Nenhum | US$ 0 |
| Tarefas agendadas para plugins | 2 | pg-boss ou Vercel Cron | US$ 0 com pg-boss; Vercel Pro ≈US$ 20/usuário |
| Observabilidade externa | 1,5 | Sentry | US$ 0 até ≈5.000 erros/mês; ≈US$ 26 no Team |
| Backup/restore agendado | 1,5 | Provedor Postgres ou R2 | Centavos com `pg_dump` no R2; ≈US$ 19–25 com restauração por ponto no tempo |
| Webhooks e tokens de API | 5 | Nenhum | US$ 0 |
| Volta ao destino após login | 0,5 | Nenhum | US$ 0 |
| Páginas de erro de autenticação | 1 | Nenhum | US$ 0 |
| **Total** | **≈60** |  | **US$ 0 a ≈US$ 90/mês** |

## Premissas e o que confirmar

- A estimativa de ≈US$ 60/mês por instância soma Resend Pro (≈US$ 20), Sentry Team (≈US$ 26), Upstash (≈US$ 5) e R2 (≈US$ 5). Cron via pg-boss evita o Vercel Pro.
- Custos são **por instância** (cada branch/site), exceto CI e Dependabot, que são do repositório. Um provedor de e-mail pode atender várias instâncias se todas usarem domínios verificados na mesma conta.
- O plano atual da Vercel e o provedor do Postgres não foram verificados; se já existir Vercel Pro, o cron não tem custo adicional.
- Dias de desenvolvimento assumem uma pessoa que já conhece o código, incluindo testes e revisão.

* [ ] Confirmar os preços nas páginas oficiais antes de contratar (valores aproximados, de memória).
* [ ] Definir o volume esperado de e-mails por mês para escolher entre plano grátis, Resend Pro ou SES.
