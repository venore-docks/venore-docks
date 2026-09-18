# Contrato de shell

> **STATUS: Abordagem A implementada.** `themeContractVersion` está em `7.0.0`
> (`src/contexts/themes/contracts/contract-version.ts`): cada tema exporta um `Shell` único, dono
> da árvore/arranjo entre Header/Footer/SidebarLeft/Content, e `src/app/(platform)/layout.tsx` só
> resolve dados e repassa. As seções 2–4 abaixo eram a comparação de abordagens que levou a essa
> decisão; a seção 5 é o que foi feito. A regra de lint da recomendação 5.6 também está no ar
> (`from: theme` não importa `context` nenhum além de `contexts/themes/contracts/**` — categoria
> `theme-contract` em `eslint.config.mjs`). Ver "Tiers de Shell" no fim.

`Objetivo original`: trocar o tema ativo deve trocar a shell (layout estrutural), não só cor/
tipografia/token — ver seção 1 pro gap que motivou a mudança.

Fontes lidas: `docs/venore-docks.md` ("Sobre temas", "Contrato de slot", regras de boundary),
`docs/ui/shell-spec.md`, `src/contexts/themes/contracts/types.ts`, `contract-version.ts`,
`src/platform/theme-rendering/resolve-active-theme.ts`, `resolve-theme-slot-props.ts`,
`src/themes/registry.ts`, `src/themes/venore-slime/**` (`index.ts`, `manifest.ts`,
`components/{Header,Footer,Content,SidebarLeft}Slot.tsx`), `src/app/(platform)/layout.tsx`,
`eslint.config.*` (regra `boundaries/dependencies`).

---

## 1. Onde o contrato atual já quebra a premissa "tema define shell"

O contrato de slot atual (`docs/venore-docks.md` — "Contrato de slot") já é, na forma, muito
próximo da Abordagem A deste documento: cada área estrutural (`HeaderSlot`, `FooterSlot`,
`ContentSlot`, `SidebarLeftSlot`) é um componente React que mora dentro do tema
(`src/themes/venore-slime/components/`) e recebe só dados já resolvidos — nunca busca dado
sozinho. Isso já está certo e não muda nesta proposta.

O que **não** está sob controle do tema é a composição espacial entre esses quatro componentes.
Isso é explícito no próprio contrato:

> "O arranjo espacial entre Content e SidebarLeft (lado a lado, sidebar à esquerda do conteúdo) é
> responsabilidade da composição da shell (`platform/`), não do tema; o tema só estiliza dentro
> da área que recebe." — `docs/venore-docks.md`

E é isso que `src/app/(platform)/layout.tsx` faz na prática:

```tsx
<Slots.Header {...props.header} />
<div className="flex flex-1">
  <Slots.SidebarLeft {...props.sidebarLeft} />
  <Slots.Content ...>{children}</Slots.Content>
</div>
<Slots.Footer {...props.footer} />
```

Essa árvore — Header em cima, `Footer` embaixo, `SidebarLeft` e `Content` lado a lado dentro de um
`flex` — é fixa em código de aplicação (`platform/`), igual para qualquer tema que algum dia entre
no `THEME_REGISTRY`. Um tema não pode decidir "minha sidebar fica à direita", "meu footer é
sticky", "não tenho sidebar, tenho abas no topo", ou "meu header e minha sidebar são a mesma
coluna vertical" — porque quem decide a arvore de regiões é `platform/`, não `src/themes/*`. Hoje
existe só um tema (`venore-slime`), então essa restrição nunca foi testada; ela só aparece como
problema no dia em que um segundo tema tentar divergir de "Header em cima / Sidebar+Content lado
a lado / Footer embaixo" — que é exatamente o teste que a Fase 2 pede.

Esse é o gap central que motiva a escolha entre as duas abordagens abaixo: não é "o tema tem
componentes próprios" (isso já existe), é "quem decide a arvore/arranjo dessas regiões".

---

## 2. Abordagem A — tema fornece os próprios componentes de shell (incluindo composição)

O tema passa a exportar, além dos quatro slots atuais, um componente raiz (`Shell` ou
`PlatformShell`) que recebe as props já resolvidas de cada região (as mesmas que
`resolveThemeSlotProps` já produz hoje) e decide sozinho a árvore: quais regiões existem, em que
ordem, com que arranjo (grid, flex, sticky, breakpoints). `platform/(platform)/layout.tsx` deixa
de montar a `<div className="flex flex-1">` e passa a só chamar `<Slots.Shell {...props}>{children}</Slots.Shell>`.

### O que acontece com um tema que não implementa uma região

Duas coisas distintas, que a abordagem A deixa naturalmente separadas:

- **Região que o tema decide nunca ter** (ex.: um tema sem `SidebarLeft` — layout de abas no
  topo): o tema simplesmente não invoca aquele slot dentro do próprio `Shell`. Nada quebra — é a
  decisão de design do tema, o mesmo espírito que `sidebarLeft.enabled`/`creditsEnabled` já
  expressam hoje em runtime, só que agora na granularidade "esse tema nunca teve esse conceito",
  não "esse conceito existe mas está desligado agora".
- **Tema estruturalmente incompleto** (não exporta `Shell`, ou `Shell` não é uma função/componente
  válido): isso não é "região ausente", é carga malformada — precisa falhar explícito na
  resolução do tema (ver seção 5, regra de erro explícito), não cair num fallback silencioso que
  mascara o problema.

A distinção importa porque a primeira é uma feature do contrato (um tema tem liberdade de recusar
regiões), a segunda é uma violação do contrato (um tema alegou implementar `themeContractVersion`
X mas não entrega o mínimo exigível).

### Como plugins/contexts continuam contribuindo navegação sem conhecer o tema

Sem mudança em relação a hoje. `resolveThemeSlotProps` (`platform/theme-rendering/`) continua
sendo o único lugar que lê `contexts/cms`, `contexts/auth`, `platform/admin-shell` etc. e produz o
objeto de props (`header`, `footer`, `sidebarLeft`, `content`) — isso já é 100% independente de
qual tema está ativo hoje, e continua assim: o `Shell` do tema recebe esse mesmo objeto, só decide
a disposição, não a origem dos dados. Plugin/context nunca soube que tema existe, antes ou depois.

### A fronteira "tema não importa de context, context não importa de tema" se mantém?

Sim, com uma ressalva que já existe hoje e não é introduzida por esta mudança: o
`eslint-plugin-boundaries` atual bloqueia `theme → context` só para arquivos **internos** do
context (categoria `context-internal`); importar o barrel público (`contexts/*/index.ts` ou
`contexts/*/contracts/**`) não é bloqueado por lint hoje, só por convenção documentada ("Contrato
de slot" — "o tema nunca busca dado sozinho"). Dar ao tema um componente `Shell` maior, com mais
superfície de composição, não piora nem melhora esse gap — mas aumenta a tentação prática de um
tema "espertinho" importar um barrel de context direto de dentro do `Shell` em vez de esperar a
prop, porque agora o tema é o dono de mais árvore JSX. Se A for a escolha, vale reforçar a regra
de lint para também barrar `theme → context-public` (só `platform/` deveria poder importar
barrels de context), fechando o gap que já existe hoje e que fica mais tentador de violar.

### Custo

- Definir e versionar o shape de `Shell` (props = união de `header`/`footer`/`sidebarLeft`/
  `content` + `children`) — bump de `themeContractVersion` (mudança de shape, não aditiva).
- Migrar `venore-slime`: mover o `<div className="flex flex-1">...</div>` de
  `(platform)/layout.tsx` para dentro de um novo `Shell.tsx` no tema.
- `(platform)/layout.tsx` fica mais simples (só resolve dados + chama `Shell`), mas quem quiser
  auditar "que arranjo estrutural o site tem hoje" precisa entrar no tema ativo — não é mais
  visível olhando só `platform/`.
- Precisa de um segundo tema mínimo (Fase 2, item de prova) implementando `Shell` do zero para
  validar que o contrato realmente não vaza suposição de arranjo do `venore-slime`.

### Onde ela quebra menos quando o segundo tema aparecer

É a abordagem desenhada para exatamente esse caso: o segundo tema pode ter uma árvore
estruturalmente diferente (sidebar à direita, sem sidebar, header não sticky, footer dentro do
scroll da sidebar, o que for) sem que `platform/` precise de um parâmetro novo para prever esse
caso — porque `platform/` nunca decidiu o arranjo, só entrega dados. O único jeito de "quebrar" é
o tema não implementar `Shell` (erro de carga, não erro de design), ou o shape de props ficar
insuficiente (precisa de mais um dado que hoje não é resolvido — mas isso já seria bump de
contrato em qualquer uma das duas abordagens, não é um problema exclusivo de A).

---

## 3. Abordagem B — tema fornece configuração/composição declarativa; componentes ficam na aplicação

Os quatro (ou mais) componentes de região continuam vivendo em `platform/` ou `components/`
(código de aplicação), parametrizados por tokens/props de estilo. O tema não exporta componentes
React — exporta um objeto de configuração (ex.: `{ regions: ["header", "sidebarLeft", "content",
"footer"], arrangement: "sidebar-left" | "sidebar-right" | "no-sidebar" | "tabs-top", sticky:
{...} }`) que um componente `GenericShell` (mantido pela aplicação) interpreta para montar a
árvore e escolher variantes dos componentes genéricos.

### O que acontece com um tema que não implementa uma região

O tema declara `regions` sem aquela chave (ou com `enabled: false`), e o `GenericShell` (código de
app) simplesmente pula aquele slot ao montar a árvore — mecanicamente parecido com a distinção da
seção 2, mas a decisão de "o que significa uma região ausente" é tomada pelo código genérico da
aplicação, não pelo tema: é a aplicação que define o vocabulário de configuração possível
(`arrangement` aceita só os valores que o `GenericShell` sabe interpretar). Um tema não pode pedir
um arranjo que o `GenericShell` não previu — não tem "escotilha" de fuga, porque não há componente
próprio, só dado.

### Como plugins/contexts continuam contribuindo navegação sem conhecer o tema

Igual à seção 2 — não muda com a escolha entre A/B, porque em nenhuma das duas o tema participa da
resolução de dados. A única diferença é que em B a superfície de "o que o tema pode expressar"
fica ainda mais estreita (só chaves de configuração previstas), o que torna ainda mais óbvio (e
mais fácil de auditar por lint/type-check) que o tema não tem acesso a nada além do vocabulário de
configuração declarado.

### A fronteira "tema não importa de context, context não importa de tema" se mantém?

Sim, e de forma estruturalmente mais forte que em A: um objeto de configuração declarativo (JSON-
like, sem função, sem import de módulo React de aplicação) não tem *como* importar um context —
não é código executável. A fronteira deixa de depender de convenção/lint e passa a ser garantida
pelo próprio shape do dado. Esse é o argumento mais forte a favor de B.

### Custo

- Desenhar o vocabulário de configuração (quais `arrangement`s existem, quais parâmetros cada um
  aceita) — esse vocabulário é, por definição, finito e antecipado por quem escreve o
  `GenericShell`, o oposto do objetivo "layout definido pelo tema".
  Isso é o problema estrutural de B: quando o segundo tema (Fase 2) quiser um arranjo que o
  vocabulário atual não previu (ex.: sidebar colapsável para ícone-only, header com duas linhas,
  footer fixo lateral), a única forma de acomodar é **editar o `GenericShell` na aplicação** —
  exatamente a regra que a sessão pede para não acontecer ("nenhuma decisão de layout pode voltar
  para a aplicação").
- Os componentes de região continuam sendo código de aplicação estilizado por token — então
  "trocar o tema" ainda troca cor/raio/sombra/tipografia (como já troca hoje), mas o quanto de
  "shell" realmente muda por tema fica limitado ao que o vocabulário de `arrangement` cobre. Isso
  é literalmente menos do que o contrato atual já entrega hoje na parte "os quatro slots são
  componentes do tema" — seria uma regressão de propriedade em relação ao que já existe.

### Onde ela quebra menos quando o segundo tema aparecer

Quebra **menos** apenas se o segundo tema (e todos os temas futuros) cabem inteiramente dentro do
vocabulário de `arrangement` já previsto no dia em que ele foi desenhado — o que é uma aposta, não
uma garantia estrutural. Na prática, o padrão histórico observado neste mesmo repositório (ver
`docs/ui/shell-spec.md` §1, "região contextual" — o protótipo e a implementação atual já
divergiram em como resolver a mesma ideia de "conteúdo contextual") sugere que arranjos futuros
tendem a surpreender um vocabulário fixado com antecedência. B tende a quebrar (= exigir mudança
em `platform/`) exatamente no momento em que teria mais valor não quebrar.

---

## 4. Comparação direta

| Pergunta | A (componentes no tema) | B (config declarativa, componentes na app) |
| --- | --- | --- |
| Tema sem região | Tema não invoca o slot dentro do próprio `Shell` — decisão do tema | `GenericShell` pula a região conforme config — decisão da app, dentro do vocabulário previsto |
| Plugins/contexts continuam alheios ao tema | Sim, inalterado (`resolveThemeSlotProps` continua sendo a única porta) | Sim, inalterado, e a fronteira é ainda mais difícil de violar por acidente (config não é código) |
| Fronteira tema↔context se mantém | Sim, mas depende de lint/convenção (gap de lint já existe hoje, deveria ser fechado) | Sim, garantida pelo shape do dado (config não importa nada) |
| Custo de um 2º tema com arranjo novo | Escreve seu próprio `Shell` — zero mudança em `platform/` | Só funciona se o `arrangement` já existir; senão exige mudar `GenericShell` (código de app) |
| Cumpre "layout nunca volta pra aplicação" | Sim, por construção | Só até o vocabulário declarado se esgotar — depois, não |

---

## 5. Recomendação: **Abordagem A**

Motivo central: o requisito explícito desta sessão ("nenhuma decisão de layout pode voltar para a
aplicação") é uma garantia estrutural em A (o tema é o único lugar que decide arvore/arranjo,
sempre) e uma garantia condicional em B (só enquanto o vocabulário declarativo já previu o caso —
e o próprio código deste repositório já mostra, no espaço "região contextual", que arranjos
futuros tendem a não caber no que foi antecipado). A abordagem B tem uma vantagem real — a
fronteira tema↔context fica garantida pelo shape do dado em vez de por convenção/lint — mas isso é
resolvível em A com uma regra de lint adicional (barrar `theme → context-public`, fechando um gap
que já existe hoje independentemente desta decisão), sem abrir mão da propriedade total de layout.

A é também a menor distância do que já existe: o contrato de slot atual já dá ao tema seus
próprios componentes (`HeaderSlot`, `FooterSlot`, `ContentSlot`, `SidebarLeftSlot`); falta só um
nível — o componente que decide como esses quatro se arranjam — que hoje mora em
`(platform)/layout.tsx` e precisa se mudar para dentro do tema.

### O que precisa mudar no contrato de tema atual (se A for aprovada)

1. **Novo export por tema**: `Shell` (nome a definir), recebendo `{ header, footer, sidebarLeft,
   content, children }` — mesmo objeto que `resolveThemeSlotProps` já produz hoje, sem campo novo.
   `ThemeRegistryEntry`/`ThemeSlotComponents` (`src/themes/registry.ts`) ganham esse quinto membro.
2. **`(platform)/layout.tsx` para de montar a árvore.** A `<div className="flex flex-1">` que hoje
   compõe `SidebarLeft`+`Content` sai de `platform/` e vira código do `Shell` de cada tema.
   `platform/` continua resolvendo dados (`resolveThemeSlotProps`, gates, nav mode, cookies) — só
   para de decidir onde cada região fica na tela.
3. **Bump de `themeContractVersion`** (mudança de shape do contrato, não aditiva — mesmo critério
   já usado nos bumps para 3.0.0/4.0.0/5.0.0 documentados em `contract-version.ts`).
4. **Atualizar `docs/venore-docks.md`** — a frase "o arranjo espacial entre Content e SidebarLeft
   ... é responsabilidade da composição da shell (`platform/`), não do tema" fica falsa e precisa
   ser substituída pela regra oposta: arranjo é sempre do `Shell` do tema.
5. **Erro explícito na carga** (requisito da Fase 2, registrado aqui porque é consequência direta
   do contrato): `resolveActiveTheme` hoje cai silenciosamente em `venore-slime` quando a
   *configuração* de tema ativo falha (`getActiveTheme` sem sucesso) — isso é comportamento correto
   e não muda (é o "Venore Slime como fallback" já documentado). O que precisa passar a existir é
   uma checagem separada, na carga do `THEME_REGISTRY`/`ThemeRegistryEntry`, de que o tema
   resolvido (`venore-slime` ou qualquer outro) realmente exporta um `Shell` válido — se não
   exportar, é erro explícito (lançar, não renderizar um shell de fallback da aplicação por baixo
   do tema incompleto). "Tema incompleto" e "configuração de tema ativo ausente" são falhas
   diferentes e devem ter tratamentos diferentes: a segunda já tem fallback correto hoje; a
   primeira não pode ganhar um fallback silencioso, porque isso é exatamente a "degradação
   silenciosa" que a sessão pede para não existir.
6. **(Recomendado, não bloqueante)** Reforçar `eslint-plugin-boundaries`: incluir `context-public`
   (barrels/contracts) na política que já bloqueia `theme → context-internal`, para que
   `theme → context` fique bloqueado por igual independente da categoria do arquivo do lado do
   context. Fecha o gap descrito na seção 2 antes que o `Shell`, com mais superfície de JSX por
   tema, o torne mais tentador de violar.

---

## Tiers de Shell

Um tema não precisa de uma `Shell` autoral. Há três níveis, do mais barato ao mais completo (um
pacote `@venore/theme-*` é self-contained — as peças de folha reaproveitadas ficam bundladas no
próprio pacote, não há import cruzado entre temas):

1. **Reskin CSS-only** — `index.ts` reexporta uma `Shell` (bundlada no pacote); o único arquivo
   próprio é o `theme.css` + o brandmark. Ex.: `@venore/theme-fearless` e `@venore/theme-nite`
   usam a Shell do antigo `venore-pulse`. É o alvo do `scripts/scaffold-theme.ts` (que parte da
   Shell do `venore-slime`).
2. **Shell mínima** — `components/Shell.tsx` próprio, compondo os slots num arranjo simples.
3. **Shell autoral** — árvore/arranjo próprios, opcionalmente reaproveitando peças de folha
   puramente comportamentais (mobile-nav store, `PlatformBrand`, `UserMenu`) já bundladas.
   Ex.: `@venore/theme-{knights,paladins,druids,sorcerers}` (cada vocação com arranjo distinto),
   `@venore/theme-academy`.

Escolha o tier deliberadamente: comece no 1, suba só quando o arranjo precisar divergir de fato.

### Scaffold

```
npx tsx scripts/scaffold-theme.ts <chave-kebab> "Nome de Exibição"
```

Cria `src/themes/<chave>/` no tier 1 (`theme.css` = cópia do `venore-slime` com o seletor
`[data-theme]` trocado, garantindo o vocabulário completo de tokens que
`theme-token-contract.test.ts` exige), `manifest.ts` com TODOs, `color-palettes.ts` via
`generateHueRotationPalettes`, e já registra o `@import` no `globals.css` e a entrada no
`registry.ts`. Depois: recolorir o `theme.css` (só valores, nunca remover token), ajustar
`brandAesthetics`/`capabilities`, e rodar `typecheck`/`lint`/`vitest run src/themes`.
