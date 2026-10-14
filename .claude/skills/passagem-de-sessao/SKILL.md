---
name: passagem-de-sessao
description: Fecha uma sessão deixando um arquivo curto de passagem para a próxima continuar sem reler tudo. Use ao terminar uma entrega, quando o contexto passar de ~150 mil tokens, ou quando pedirem "encerrar", "passar para outra sessão" ou "continuar amanhã".
---

# Passagem de sessão

Objetivo: a próxima sessão começa lendo um arquivo de até ~60 linhas, em vez de herdar centenas de milhares de
tokens de conversa.

1. Escreva `docs/sessoes/<AAAA-MM-DD>-<tema-curto>.md` (no repositório onde o trabalho continua) com só isto:
   - **Objetivo** — 1–2 frases.
   - **Estado** — o que está pronto (commits/PRs), o que falta, em lista curta.
   - **Decisões tomadas** — e o porquê, uma linha cada; nada que já esteja no código ou no commit.
   - **Arquivos-chave** — até 10 caminhos `arquivo:linha` por onde a próxima sessão deve começar.
   - **Próximo passo** — a primeira ação concreta.
   - **Armadilhas** — o que já deu errado e não deve ser repetido.
2. Não copie diffs, logs nem trechos longos: aponte para commit, arquivo ou execução de CI.
3. Comite junto com o último commit da tarefa (`docs(sessoes): passagem de <tema>`).
4. Diga ao usuário para abrir uma sessão nova com: "Continue a partir de `docs/sessoes/<arquivo>.md`".
5. Quando a frente de trabalho terminar, apague o arquivo no mesmo commit que a encerra.
