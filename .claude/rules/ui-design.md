---
paths:
  - "src/**/*.tsx"
---
# Design de interface: telas que guiam (vale para o core e para todo plugin, em qualquer tema)

Objetivo: telas limpas, com pouca distração, que conduzem cada papel (cliente, agente, gestor,
administrador) dentro da sua função. A informação relevante continua na tela, mas **só o que pede
ação chama atenção**. Esta regra trata de composição; os valores (cores, contraste) são do tema
(`css-tokens.md`). Referência visual com antes e depois: `C:\dev\venore\colabora-design-exemplos.html`.

## 1. Cor é sinal de ação
- Cor forte (fundo `*-soft`, texto `text-warning`/`text-destructive`) só para: algo **espera a
  pessoa**, **urgente**, **atrasado**, **erro** e **nota interna** (onde a cor evita um erro).
- Estado e categoria usam selo neutro (`border bg-card`) com bolinha `size-1.5` na cor do estado.
  Nunca selo colorido + faixa lateral + bolinha + borda no mesmo item.
- **Um sinal por item**: escolha um entre selo, ícone e cor de texto.
- Cor decorativa por categoria (ícone de setor colorido, avatar com anel colorido) vira
  `text-muted-foreground`/`bg-muted`.

## 2. Uma ação principal por bloco
- Um único botão cheio (`Button` padrão) por bloco. Alternativas em `variant="outline"`, e caminhos
  negativos ou raros em link de texto (`text-muted-foreground hover:underline`).
- Botão cheio em cor semântica (success/warning/destructive) só no botão de confirmação de um
  diálogo destrutivo.
- O mesmo destino não aparece duas vezes na tela (aba + botão no cabeçalho + tile clicável).
- O chamado à ação da página fica no canto do título (outline) ou é o próprio conteúdo (ex.: a
  lista de setores é o "abrir chamado").

## 3. O secundário fica recolhido
- Detalhes técnicos, campos raros e ajustes manuais vão para `<details>`/Collapsible ("Mais
  opções", "Detalhes").
- Status saudável ocupa uma linha; problema vira cartão expandido no topo.
- Contadores e limites (caracteres, anexos) aparecem só quando importam: perto do limite ou no erro.
- Listas mostram título + 2 ou 3 metadados (`text-xs text-muted-foreground`, separados por ` · `).
  Número interno, tags e responsável ficam no detalhe.

## 4. Números
- Tile grande só quando o número é a decisão. Prefira uma frase ("7 com você · 3 esperam sua
  resposta") ou uma faixa `grid divide-x rounded-lg border` com `text-2xl`.
- Métricas que se sobrepõem (o mesmo item contado em mais de uma) não ficam lado a lado.
- Número exibido é clicável e leva à lista filtrada correspondente.

## 5. Um nível de caixa
- No máximo um nível de cartão (`rounded-lg border bg-card`) por região da tela. Dentro dele:
  `divide-y`, espaçamento e títulos, nunca outro cartão com borda.
- Sem bordas decorativas grossas (`border-t-4`, `border-s-4`, `border-2`).
- Lista padrão: `ul.divide-y.overflow-hidden.rounded-lg.border.bg-card` com linhas
  `px-4 py-3 hover:bg-muted/50`.

## 6. Navegação
- Abas sublinhadas, não pílulas cheias. Indicador da aba ativa por sombra interna
  (`shadow-[inset_0_-2px_0_var(--color-primary)]`), nunca `border-b-2 -mb-px` dentro de container
  com `overflow-x-auto` (vaza 1 px e cria barra de rolagem).
- Contador na aba só para pendência: pendência da pessoa em `text-warning`, volume em
  `text-muted-foreground`, sem fundo.
- Sem rótulo em maiúsculas (eyebrow) repetindo o nome do plugin acima do título.

## 7. Hierarquia de texto
- Página: `text-2xl font-semibold tracking-tight`. Seção: `text-lg` ou `text-sm font-semibold`.
  Metadados: `text-xs text-muted-foreground`.
- Sem `uppercase tracking-wide` em rótulos internos.
- Progresso por etapas: barra fina neutra (`h-1 bg-foreground/60` / `bg-muted`) com "Etapa N de M"
  em `text-xs text-muted-foreground` ao lado, e o nome de cada etapa no `title`.

## 8. Confirmação
- Diálogo de confirmação só para o que notifica outra pessoa ou não tem volta. O resto executa
  direto e oferece "Desfazer" no toast.

## Checklist antes de entregar uma tela
1. Quantas coisas têm cor forte? Só as que pedem ação.
2. Quantos botões cheios por bloco? Um.
3. Algum destino aparece duas vezes?
4. Quantos níveis de borda aninhada? Um.
5. Confere no modo claro **e** no escuro. Se faltar contraste, o ajuste é no `theme.css` do tema,
   nunca uma cor fixa na tela.
