Lista de blocos e suas funções

Claude, você vai notar que podemos consumir o shadcn dentro destes blocos. 
Você é o cara, veja como podemos criar esses blocos da forma correta e escalável.

# Blocos sugeridos para o Page Builder

| Bloco | Função | Justificativa |
|-------|--------|---------------|
| Section | Área que agrupa várias rows | Permite definir fundo, espaçamento, largura máxima e separar seções da página. |
| Container | Limita largura do conteúdo | Evita repetir configurações de largura máxima em todas as rows. |
| Divider | Linha horizontal ou separador visual | Muito utilizado para dividir conteúdos. |
| Spacer | Espaço vertical configurável | Evita criar margens artificiais apenas para espaçamento. |
| Icon | Exibe um ícone | Ícones são usados em praticamente todas as interfaces. |
| Badge | Pequena etiqueta de destaque | Ideal para exibir informações como "Novo", "Beta" ou "Promoção". |
| Quote | Bloco de citação | Dá destaque para frases ou depoimentos. |
| Code | Exibe código formatado | Necessário para documentação técnica. |
| Markdown | Renderiza conteúdo Markdown | Excelente para blogs e documentação. |
| Alert | Caixa de aviso | Exibe mensagens de sucesso, erro, aviso ou informação. |
| List | Lista ordenada ou não ordenada | Mais flexível do que RichText para listas simples. |
| Table | Exibe dados tabulares | Útil para comparativos e documentação. |
| Video | Incorpora vídeos | Permite adicionar YouTube, Vimeo ou vídeos próprios. |
| Audio | Player de áudio | Útil para cursos, podcasts e músicas. |
| File | Link para download de arquivos | Facilita disponibilizar PDFs e documentos. |
| Gallery | Galeria de imagens | Melhor experiência do que várias imagens soltas. |
| Carousel | Carrossel de conteúdo | Muito usado em landing pages e galerias. |
| Card | Cartão de conteúdo | Estrutura reutilizável para produtos, serviços e notícias. |
| Card Grid | Grade de cards | Facilita a organização de múltiplos cards. |
| Hero | Cabeçalho principal da página | Acelera a criação de landing pages. |
| CTA | Call To Action | Bloco dedicado para conversão. |
| Feature List | Lista de benefícios ou funcionalidades | Muito comum em páginas institucionais e SaaS. |
| Pricing | Tabela de preços | Bastante utilizada em produtos e assinaturas. |
| FAQ | Perguntas frequentes | Estrutura padrão para dúvidas comuns. |
| Accordion | Conteúdo expansível | Reutilizável em vários cenários além de FAQ. |
| Tabs | Organização de conteúdo em abas | Permite dividir informações sem aumentar a página. |
| Timeline | Linha do tempo | Ideal para histórias, cronologias e processos. |
| Steps | Passo a passo | Excelente para tutoriais e onboarding. |
| Stats | Indicadores numéricos | Exibe métricas e resultados importantes. |
| Progress | Barra de progresso | Útil para processos e cursos. |
| Avatar | Foto de perfil | Base para usuários e depoimentos. |
| Testimonial | Depoimento de cliente | Aumenta credibilidade em páginas comerciais. |
| Logo Cloud | Grade de logotipos | Exibe clientes, parceiros ou patrocinadores. |
| Map | Mapa incorporado | Exibe localização física. |
| Form | Agrupador de formulário | Permite construir formulários completos. |
| Input | Campo de texto | Elemento básico de formulários. |
| Textarea | Campo de texto longo | Utilizado para mensagens e descrições. |
| Select | Lista suspensa | Permite seleção entre opções. |
| Checkbox | Caixa de seleção | Utilizada para múltiplas escolhas. |
| Radio | Opção única | Utilizada para escolhas exclusivas. |
| Switch | Interruptor liga/desliga | Muito usado em configurações. |
| Date Picker | Seletor de data | Facilita entrada de datas. |
| Countdown | Contador regressivo | Bastante usado em eventos e campanhas. |
| Embed | Incorporação de conteúdo externo | Permite adicionar iframes e serviços externos. |
| HTML | HTML customizado | Flexibilidade para casos avançados. |
| Component | Componente React registrado | Permite estender o builder com componentes próprios. |

## Ordem de implementação sugerida

| Prioridade | Blocos |
|------------|---------|
| Essencial | Section, Spacer, Divider, Icon, List, Quote |
| Muito úteis | Gallery, Accordion, Card, Card Grid, Video |
| Landing Pages | Hero, CTA, Feature List, Stats, Pricing, FAQ, Testimonial, Logo Cloud |
| Conteúdo | Markdown, Table, Code, File |
| Formulários | Form, Input, Textarea, Select, Checkbox, Radio |
| Avançados | Tabs, Timeline, Steps, Carousel, Embed, HTML, Component |