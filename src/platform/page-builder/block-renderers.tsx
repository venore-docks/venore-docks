import "server-only";
import type { ReactNode } from "react";
import Link from "next/link";
import { hasRichTextContent, renderRichTextContent, RICH_TEXT_INLINE_CLASSES } from "./rich-text/render";
import type { LucideIcon } from "lucide-react";
import type { Block, Composition } from "@/contexts/cms";
import { getMediaAsset } from "@/contexts/media";
import { NAV_ICON_BY_KEY } from "@/platform/nav-icons/registry";
import { Button, type buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { PLUGIN_CONTRIBUTIONS } from "@/plugins/contributions";
import { ROW_BLOCK_KEY, resolveRowColumns, resolveRowGridClasses } from "./row-columns";
import { CarouselBlockClient } from "./carousel-block-client";
import { HERO_BLOCK_KEY } from "./blocks/hero";
import { CTA_BLOCK_KEY } from "./blocks/cta";
import { GALLERY_BLOCK_KEY } from "./blocks/gallery";
import { CAROUSEL_BLOCK_KEY } from "./blocks/carousel";

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;

// "edit": bloco não configurado vira placeholder visível (o editor precisa mostrar que o botão
// existe mas está incompleto). "published": some, como sempre foi — pedido explícito da sessão
// pra parar de confundir "não configurado" com "não existe" só no modo edit.
export type BlockRenderMode = "edit" | "published";

// Assinatura única pra todo renderer de bloco (core ou plugin) — row deixa de ser caso
// especial: renderBlocks é o mesmo renderer recursivo do block-renderer.tsx, injetado, então
// um plugin futuro com blocos de "areas" tem o mesmo mecanismo que row usa.
export type BlockRendererProps = {
  block: Block;
  mode: BlockRenderMode;
  // Devolve um array (um ReactNode por bloco filho, já com key), não um nó mesclado — a maioria
  // dos renderers só empilha `{content}` direto (ReactNode[] é um ReactNode válido), mas
  // CarouselBlock precisa envolver cada item individualmente em CarouselItem.
  renderBlocks: (blocks: Composition) => Promise<ReactNode[]>;
};
export type BlockRendererComponent = (props: BlockRendererProps) => ReactNode | Promise<ReactNode>;

const GAP_CLASSES: Record<string, string> = {
  sm: "gap-2 sm:gap-3",
  md: "gap-3 sm:gap-4",
  lg: "gap-4 sm:gap-6",
};

const ALIGN_CLASSES: Record<string, string> = {
  start: "items-start",
  center: "items-center",
  stretch: "items-stretch",
};

// Sempre escuro nos dois modos: foreground é escuro no claro e claro no escuro (convenção shadcn
// padrão), então bg-foreground/dark:bg-background cobre os dois casos sem nenhum hex novo — ver
// theme.css do venore-slime (--background/--foreground invertem entre :root e .dark).
const HERO_OVERLAY_CLASSES: Record<string, string> = {
  none: "",
  dark: "bg-foreground/50 dark:bg-background/60",
  gradient: "bg-gradient-to-t from-foreground/70 dark:from-background/80 via-foreground/20 dark:via-background/30 to-transparent",
};

const CTA_BACKGROUND_CLASSES: Record<string, string> = {
  muted: "bg-muted",
  primary: "bg-primary text-primary-foreground",
  panel: "bg-card border border-border",
};

// shadow-panel/shadow-float (não shadow-sm/shadow-md genéricos do Tailwind) — mesmo vocabulário
// de elevação já usado no resto do app (login/error pages, UserMenu, cards de listagem pública em
// [...slug]/page.tsx), orientado pelos tokens --shadow-panel/--shadow-float que cada tema define
// (theme.css) — reage a troca de tema como qualquer outro token, nunca um valor novo hardcoded.
const SURFACE_CLASSES: Record<string, string> = {
  none: "",
  panel: "rounded-panel border border-border bg-card p-4 shadow-panel",
  elevated: "rounded-panel bg-muted p-4 shadow-float",
};

const WIDTH_CLASSES: Record<string, string> = {
  full: "w-full",
  medium: "mx-auto w-full max-w-md",
  small: "mx-auto w-full max-w-xs",
};

const HEADING_ALIGN_CLASSES: Record<string, string> = {
  start: "text-start",
  center: "text-center",
  end: "text-end",
};

const HEADING_SIZE_CLASSES: Record<string, string> = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl",
  "2xl": "text-4xl",
  "3xl": "text-5xl",
  "4xl": "text-6xl",
};

// Antes desta sessão, level (tag semântica) e tamanho visual eram a mesma coisa — entries
// salvas sem o campo "size" (novo) precisam continuar do mesmo tamanho que já tinham.
const LEGACY_HEADING_LEVEL_SIZE: Record<number, string> = { 1: "2xl", 2: "xl", 3: "lg", 4: "md" };

// Só as duas famílias já carregadas pelo app (layout.tsx: Geist Sans/Geist Mono).
const HEADING_FONT_CLASSES: Record<string, string> = {
  sans: "font-sans",
  mono: "font-mono",
};

// Tokens --ui-tracking-* do tema (theme.css) via as utilities tracking-copy/tracking-display/
// tracking-caps já geradas em globals.css (@theme inline) — nunca um valor de tracking solto.
const HEADING_TRACKING_CLASSES: Record<string, string> = {
  normal: "tracking-copy",
  tight: "tracking-display",
  wide: "tracking-caps",
};

const BUTTON_VARIANTS = new Set<ButtonVariant>(["default", "outline", "secondary", "ghost"]);

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";
const BADGE_VARIANTS = new Set<BadgeVariant>(["default", "secondary", "outline", "destructive"]);

type AlertVariant = "default" | "destructive" | "warning" | "success" | "info";
const ALERT_VARIANTS = new Set<AlertVariant>(["default", "destructive", "warning", "success", "info"]);

// Alert do shadcn (src/components/ui/alert.tsx, não editado diretamente — regra da sessão) só
// declara "default"/"destructive" no cva. Warning/success/info são camadas de className por cima
// de variant="default", replicando o mesmo truque que a variante "destructive" nativa já usa pra
// colorir AlertDescription (*:data-[slot=alert-description]:text-destructive/90 dentro do próprio
// alertVariants). "info" reaproveita border/secondary — sem token de cor próprio, mesma decisão
// já documentada em AGENTS.md (tabela de migração: "info-*" não tem papel no shadcn).
const ALERT_TONE_CLASSNAMES: Partial<Record<AlertVariant, string>> = {
  warning: "border-warning-border bg-warning-soft text-warning *:data-[slot=alert-description]:text-warning/90",
  success: "border-success-border bg-success-soft text-success *:data-[slot=alert-description]:text-success/90",
  info: "border-border bg-secondary text-secondary-foreground *:data-[slot=alert-description]:text-secondary-foreground/90",
};

function toNativeAlertVariant(tone: AlertVariant): "default" | "destructive" {
  return tone === "destructive" ? "destructive" : "default";
}

const SPACER_SIZE_CLASSES: Record<string, string> = {
  sm: "h-4",
  md: "h-8",
  lg: "h-16",
  xl: "h-24",
};

const ICON_SIZE_CLASSES: Record<string, string> = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
};

const ICON_TONE_CLASSES: Record<string, string> = {
  foreground: "text-foreground",
  muted: "text-muted-foreground",
  primary: "text-primary",
};


const SECTION_BACKGROUND_CLASSES: Record<string, string> = {
  none: "",
  panel: "bg-card",
  muted: "bg-muted",
  secondary: "bg-secondary",
  // primary/accent nunca sólidos (regra já documentada em AGENTS.md pra accent-soft) — opacidade
  // fixa em vez da variante -soft de warning/success porque não existe --primary-soft/--accent-soft
  // declarado no tema (só warning/success têm essa variante hoje).
  primary: "bg-primary/10",
  accent: "bg-accent/14",
  warning: "bg-warning-soft",
  success: "bg-success-soft",
};

const SECTION_MAX_WIDTH_CLASSES: Record<string, string> = {
  full: "max-w-none",
  "7xl": "max-w-7xl",
  "5xl": "max-w-5xl",
  "3xl": "max-w-3xl",
};

const SECTION_PADDING_Y_CLASSES: Record<string, string> = {
  none: "",
  xs: "py-2 sm:py-3",
  sm: "py-4 sm:py-6",
  md: "py-8 sm:py-12",
  lg: "py-12 sm:py-20",
  xl: "py-16 sm:py-28",
};

// px-6 é o mesmo padding horizontal usado em ContentSlot/Breadcrumbs de todos os temas — aqui só
// configurável por seção, com a mesma escala de passos de SECTION_PADDING_Y_CLASSES.
const SECTION_PADDING_X_CLASSES: Record<string, string> = {
  none: "",
  xs: "px-3 sm:px-4",
  sm: "px-4 sm:px-6",
  md: "px-6 sm:px-8",
  lg: "px-8 sm:px-12",
  xl: "px-10 sm:px-16",
};

const CARD_GRID_COLUMN_CLASSES: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

function readString(data: Block["data"], key: string, fallback = ""): string {
  const value = data[key];
  return typeof value === "string" ? value : fallback;
}

function readArea(block: Block, key: string) {
  return block.areas.find((area) => area.key === key) ?? null;
}

function clampPercent(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

async function RowBlock({ block, renderBlocks }: BlockRendererProps) {
  const columns = resolveRowColumns(block.data);
  const gap = GAP_CLASSES[readString(block.data, "gap", "md")] ?? GAP_CLASSES.md;
  const align = ALIGN_CLASSES[readString(block.data, "align", "stretch")] ?? ALIGN_CLASSES.stretch;
  const surface = SURFACE_CLASSES[readString(block.data, "surface", "none")] ?? "";

  // Só as N primeiras areas (na ordem em que foram criadas: col-1..col-4) — bloco em coluna
  // oculta continua no dado, só não é renderizado aqui (o editor mostra o aviso).
  const areas = await Promise.all(
    block.areas.slice(0, columns).map(async (area) => ({
      key: area.key,
      content: await renderBlocks(area.blocks),
    })),
  );

  return (
    <div id={block.htmlId ?? undefined} className={cn("grid", resolveRowGridClasses(block.data, columns), gap, align, surface)}>
      {areas.map(({ key, content }) => (
        // space-y-4: cada coluna nunca tinha espaçamento próprio entre os blocos empilhados
        // dentro dela (bug — heading/texto/botão renderizavam colados). Mesmo passo de
        // SECTION_PADDING_Y_CLASSES/RICHTEXT_CLASSES já usado no resto do page-builder.
        <div key={key} className="space-y-4">
          {content}
        </div>
      ))}
    </div>
  );
}

function HeadingBlock({ block }: BlockRendererProps) {
  const data = block.data;
  const level = Number(data.level) || 2;
  const text = readString(data, "text");
  const align = HEADING_ALIGN_CLASSES[readString(data, "align", "start")] ?? HEADING_ALIGN_CLASSES.start;
  // data.size ausente = entry salva antes do campo existir — deriva da tag (level), preservando o
  // tamanho visual que a entry já tinha (level e size eram a mesma coisa antes desta sessão).
  const size = HEADING_SIZE_CLASSES[readString(data, "size")] ?? HEADING_SIZE_CLASSES[LEGACY_HEADING_LEVEL_SIZE[level] ?? "xl"];
  const fontFamily = HEADING_FONT_CLASSES[readString(data, "fontFamily", "sans")] ?? HEADING_FONT_CLASSES.sans;
  const tracking = HEADING_TRACKING_CLASSES[readString(data, "tracking", "tight")] ?? HEADING_TRACKING_CLASSES.tight;
  const uppercase = data.uppercase === true;
  const className = cn("font-semibold text-foreground", size, fontFamily, tracking, uppercase && "uppercase", align);

  const id = block.htmlId ?? undefined;
  if (level === 1) return <h1 id={id} className={className}>{text}</h1>;
  if (level === 3) return <h3 id={id} className={className}>{text}</h3>;
  if (level === 4) return <h4 id={id} className={className}>{text}</h4>;
  return <h2 id={id} className={className}>{text}</h2>;
}

const RICHTEXT_CLASSES = cn(
  "max-w-none space-y-3 text-foreground",
  "[&_a]:text-primary [&_a]:underline",
  "[&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:text-xl [&_h3]:font-semibold",
  "[&_p]:leading-relaxed",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
);

function RichtextBlock({ block }: BlockRendererProps) {
  const content = block.data.content;
  if (!hasRichTextContent(content)) {
    return null;
  }
  return <div className={RICHTEXT_CLASSES}>{renderRichTextContent(content)}</div>;
}

async function ImageBlock({ block }: BlockRendererProps) {
  const data = block.data;
  const mediaId = readString(data, "mediaId");
  const mediaResult = await getMediaAsset({ id: mediaId });
  if (!mediaResult.success || !mediaResult.data) {
    return null;
  }

  const media = mediaResult.data;
  const alt = readString(data, "alt", media.filename);
  const caption = readString(data, "caption");
  const width = WIDTH_CLASSES[readString(data, "width", "full")] ?? WIDTH_CLASSES.full;

  return (
    <figure className={width}>
      {/* eslint-disable-next-line @next/next/no-img-element -- mesmo padrão de media-picker-field.tsx, sem domínio remoto configurado pra next/image */}
      <img src={media.url} alt={alt} className="w-full rounded-panel object-cover" />
      {caption && <figcaption className="mt-1 text-xs text-muted-foreground/56">{caption}</figcaption>}
    </figure>
  );
}

function SpacerBlock({ block }: BlockRendererProps) {
  const size = SPACER_SIZE_CLASSES[readString(block.data, "size", "md")] ?? SPACER_SIZE_CLASSES.md;
  return <div className={size} aria-hidden="true" />;
}

function DividerBlock({ block }: BlockRendererProps) {
  const label = readString(block.data, "label");
  if (!label) {
    return <Separator />;
  }
  return (
    <div className="flex items-center gap-3">
      <Separator className="flex-1" />
      <span className="shrink-0 text-xs text-muted-foreground/56">{label}</span>
      <Separator className="flex-1" />
    </div>
  );
}

function IconBlock({ block }: BlockRendererProps) {
  const name = readString(block.data, "name", "star");
  const IconComponent = NAV_ICON_BY_KEY[name] ?? NAV_ICON_BY_KEY.star;
  const size = ICON_SIZE_CLASSES[readString(block.data, "size", "md")] ?? ICON_SIZE_CLASSES.md;
  const tone = ICON_TONE_CLASSES[readString(block.data, "tone", "foreground")] ?? ICON_TONE_CLASSES.foreground;
  return <IconComponent className={cn(size, tone)} strokeWidth={1.75} />;
}

function BadgeBlock({ block }: BlockRendererProps) {
  const text = readString(block.data, "text");
  const requestedVariant = readString(block.data, "variant", "default") as BadgeVariant;
  const variant = BADGE_VARIANTS.has(requestedVariant) ? requestedVariant : "default";
  const uppercase = block.data.uppercase === true;
  return (
    <Badge variant={variant} className={uppercase ? "uppercase tracking-caps" : undefined}>
      {text}
    </Badge>
  );
}

function QuoteBlock({ block }: BlockRendererProps) {
  const text = block.data.text;
  const author = readString(block.data, "author");
  return (
    <blockquote className="border-l-2 border-border pl-4">
      <div className={cn("text-lg leading-relaxed text-foreground italic", RICH_TEXT_INLINE_CLASSES)}>
        {renderRichTextContent(text)}
      </div>
      {author && <cite className="mt-2 block text-sm text-muted-foreground not-italic">— {author}</cite>}
    </blockquote>
  );
}

// Ícone + título ficam num wrapper à parte (não como filho direto de <Alert>) de propósito: o
// grid nativo do Alert stock (has-[>svg]:grid-cols-[auto_1fr]) posiciona o ícone ao lado de
// título E descrição juntos, sem noção de mobile — aqui o pedido é ícone só ao lado do título
// (desktop) / acima do título (mobile), então a responsividade mora neste wrapper, não no Alert.
// Compartilhado por qualquer bloco que precise de "ícone + título", responsivo (ícone ao lado do
// título no desktop, acima no mobile) — Alert e Section usam o mesmo padrão, então mora aqui em
// vez de duplicado nos dois renderers.
const ICON_TITLE_ALIGN_CLASSES: Record<string, string> = {
  start: "items-start text-left sm:items-center sm:justify-start",
  center: "items-center text-center sm:items-center sm:justify-center",
  end: "items-end text-right sm:items-center sm:justify-end",
};

function IconTitleRow({
  icon: Icon,
  align,
  iconClassName,
  className,
  children,
}: {
  icon: LucideIcon | null;
  align: string;
  iconClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  const alignClass = ICON_TITLE_ALIGN_CLASSES[align] ?? ICON_TITLE_ALIGN_CLASSES.start;
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row", alignClass, className)}>
      {Icon && <Icon className={cn("size-4 shrink-0", iconClassName)} strokeWidth={1.75} />}
      {children}
    </div>
  );
}

function AlertBlockRenderer({ block }: BlockRendererProps) {
  const title = readString(block.data, "title");
  const description = block.data.description;
  const requestedVariant = readString(block.data, "variant", "default") as AlertVariant;
  const tone = ALERT_VARIANTS.has(requestedVariant) ? requestedVariant : "default";
  const iconName = readString(block.data, "icon");
  const IconComponent = iconName ? NAV_ICON_BY_KEY[iconName] : null;
  const titleAlign = readString(block.data, "titleAlign", "start");

  return (
    <Alert variant={toNativeAlertVariant(tone)} className={ALERT_TONE_CLASSNAMES[tone]}>
      <IconTitleRow icon={IconComponent} align={titleAlign}>
        <AlertTitle>{title}</AlertTitle>
      </IconTitleRow>
      {hasRichTextContent(description) && (
        <AlertDescription className={RICH_TEXT_INLINE_CLASSES}>{renderRichTextContent(description)}</AlertDescription>
      )}
    </Alert>
  );
}

function ListBlock({ block }: BlockRendererProps) {
  const raw = readString(block.data, "items");
  const ordered = block.data.ordered === true;
  const items = raw
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (items.length === 0) {
    return null;
  }

  const className = cn("space-y-1 pl-5 text-foreground", ordered ? "list-decimal" : "list-disc");
  if (ordered) {
    return (
      <ol className={className}>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ol>
    );
  }
  return (
    <ul className={className}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

function ProgressBlockRenderer({ block }: BlockRendererProps) {
  const label = readString(block.data, "label");
  const showPercent = block.data.showPercent !== false;
  const value = clampPercent(block.data.value);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        {showPercent && <span className="text-muted-foreground/56">{value}%</span>}
      </div>
      <Progress value={value} />
    </div>
  );
}

async function CardBlock({ block }: BlockRendererProps) {
  const data = block.data;
  const mediaId = readString(data, "mediaId");
  const title = readString(data, "title");
  const description = data.description;
  const href = readString(data, "href");
  const buttonLabel = readString(data, "buttonLabel", "Saiba mais");

  let mediaUrl: string | null = null;
  if (mediaId) {
    const mediaResult = await getMediaAsset({ id: mediaId });
    if (mediaResult.success && mediaResult.data) {
      mediaUrl = mediaResult.data.url;
    }
  }

  return (
    <Card className="h-full ui-motion-base hover:shadow-float">
      {mediaUrl && (
        // Card (ui/card.tsx) já trata <img> como primeiro filho: remove o padding-top e arredonda
        // o topo sozinho (has-[>img:first-child]:pt-0, *:[img:first-child]:rounded-t-xl).
        // eslint-disable-next-line @next/next/no-img-element -- mesmo padrão de ImageBlock, sem domínio remoto configurado pra next/image
        <img src={mediaUrl} alt={title} className="aspect-video w-full object-cover" />
      )}
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {hasRichTextContent(description) && (
          <CardDescription className={RICH_TEXT_INLINE_CLASSES}>{renderRichTextContent(description)}</CardDescription>
        )}
      </CardHeader>
      {href && (
        <CardFooter>
          <Button asChild size="sm" variant="outline">
            <Link href={href}>{buttonLabel}</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

async function AudioBlock({ block }: BlockRendererProps) {
  const data = block.data;
  const mediaId = readString(data, "mediaId");
  const title = readString(data, "title");
  const showDownloadLink = data.showDownloadLink === true;

  if (!mediaId) {
    return null;
  }

  const mediaResult = await getMediaAsset({ id: mediaId });
  if (!mediaResult.success || !mediaResult.data) {
    return null;
  }
  const media = mediaResult.data;

  return (
    <Card className="shadow-panel">
      <CardContent className="space-y-2">
        {title && <p className="text-sm font-medium text-foreground">{title}</p>}
        <audio controls src={media.url} className="w-full" />
        {showDownloadLink && (
          <a href={media.url} download={media.filename} className="text-xs font-medium text-primary hover:underline">
            Baixar arquivo
          </a>
        )}
      </CardContent>
    </Card>
  );
}

async function SectionBlock({ block, renderBlocks }: BlockRendererProps) {
  const background = SECTION_BACKGROUND_CLASSES[readString(block.data, "background", "none")] ?? "";
  const maxWidth = SECTION_MAX_WIDTH_CLASSES[readString(block.data, "maxWidth", "full")] ?? SECTION_MAX_WIDTH_CLASSES.full;
  const paddingY = SECTION_PADDING_Y_CLASSES[readString(block.data, "paddingY", "md")] ?? SECTION_PADDING_Y_CLASSES.md;
  const paddingX = SECTION_PADDING_X_CLASSES[readString(block.data, "paddingX", "md")] ?? SECTION_PADDING_X_CLASSES.md;
  const title = readString(block.data, "title");
  const iconName = readString(block.data, "icon");
  const IconComponent = iconName ? NAV_ICON_BY_KEY[iconName] : null;
  const titleAlign = readString(block.data, "titleAlign", "start");
  const area = readArea(block, "content");
  const content = area ? await renderBlocks(area.blocks) : null;

  return (
    <section id={block.htmlId ?? undefined} className={cn(background, paddingY, paddingX)}>
      {/* space-y-6 (não -4): uma seção empilha blocos estruturalmente distintos (um heading, um
          card-grid inteiro, um botão) — pede mais respiro que o ritmo interno de uma coluna de
          row (RowBlock, mais acima) ou de parágrafos do mesmo texto corrido (RICHTEXT_CLASSES,
          space-y-3). Hierarquia de espaçamento do sistema: 3 (mesmo parágrafo) < 4 (mesma
          coluna/cluster) < 6 (blocos distintos de uma seção). */}
      <div className={cn("mx-auto w-full space-y-6", maxWidth)}>
        {(title || IconComponent) && (
          <IconTitleRow icon={IconComponent} align={titleAlign} iconClassName="size-6 text-foreground">
            {title && <h2 className="text-2xl font-semibold text-foreground">{title}</h2>}
          </IconTitleRow>
        )}
        {content}
      </div>
    </section>
  );
}

async function AccordionBlock({ block, renderBlocks }: BlockRendererProps) {
  const allowMultiple = block.data.allowMultiple === true;
  const area = readArea(block, "items");
  const items = area ? await renderBlocks(area.blocks) : null;

  return (
    <Card className="shadow-panel">
      <CardContent>
        {allowMultiple ? (
          <Accordion type="multiple">{items}</Accordion>
        ) : (
          <Accordion type="single" collapsible>
            {items}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}

async function AccordionItemBlock({ block, renderBlocks }: BlockRendererProps) {
  const title = readString(block.data, "title", "Item");
  const area = readArea(block, "content");
  const content = area ? await renderBlocks(area.blocks) : null;

  return (
    <AccordionItem value={block.id}>
      <AccordionTrigger>{title}</AccordionTrigger>
      <AccordionContent>{content}</AccordionContent>
    </AccordionItem>
  );
}

async function TabsBlock({ block, renderBlocks }: BlockRendererProps) {
  const area = readArea(block, "items");
  const children = area?.blocks ?? [];
  const content = area ? await renderBlocks(area.blocks) : null;

  if (children.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-panel">
      <CardContent>
        <Tabs defaultValue={children[0].id} className="w-full">
          <TabsList className="w-full">
            {children.map((child) => (
              <TabsTrigger key={child.id} value={child.id}>
                {readString(child.data, "label", "Aba")}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="pt-4">{content}</div>
        </Tabs>
      </CardContent>
    </Card>
  );
}

async function TabsItemBlock({ block, renderBlocks }: BlockRendererProps) {
  const area = readArea(block, "content");
  const content = area ? await renderBlocks(area.blocks) : null;
  return <TabsContent value={block.id}>{content}</TabsContent>;
}

async function CardGridBlock({ block, renderBlocks }: BlockRendererProps) {
  const requestedColumns = Number(block.data.columns) || 3;
  const columns = CARD_GRID_COLUMN_CLASSES[requestedColumns] ? requestedColumns : 3;
  const area = readArea(block, "items");
  const content = area ? await renderBlocks(area.blocks) : null;

  return <div className={cn("grid gap-4 sm:gap-6", CARD_GRID_COLUMN_CLASSES[columns])}>{content}</div>;
}

function ButtonBlock({ block }: BlockRendererProps) {
  const data = block.data;
  const href = readString(data, "href");
  const label = readString(data, "label", "Saiba mais");
  const requestedVariant = readString(data, "variant", "default") as ButtonVariant;
  const variant = BUTTON_VARIANTS.has(requestedVariant) ? requestedVariant : "default";

  return (
    <Button asChild variant={variant}>
      <Link href={href}>{label}</Link>
    </Button>
  );
}

async function HeroBlock({ block }: BlockRendererProps) {
  const data = block.data;
  const eyebrow = readString(data, "eyebrow");
  const title = readString(data, "title");
  const subtitle = readString(data, "subtitle");
  const mediaId = readString(data, "mediaId");
  const align = readString(data, "align", "start");
  const overlay = HERO_OVERLAY_CLASSES[readString(data, "overlay", "none")] ?? "";
  const primaryLabel = readString(data, "primaryLabel");
  const primaryHref = readString(data, "primaryHref");
  const secondaryLabel = readString(data, "secondaryLabel");
  const secondaryHref = readString(data, "secondaryHref");

  let mediaUrl: string | null = null;
  if (mediaId) {
    const mediaResult = await getMediaAsset({ id: mediaId });
    if (mediaResult.success && mediaResult.data) {
      mediaUrl = mediaResult.data.url;
    }
  }

  // Texto sobre imagem usa o par primary/primary-foreground (não foreground/background) — mesmo
  // raciocínio do overlay acima: é o par de tokens já pensado pra "conteúdo sobre uma superfície
  // forte", garantido legível nos dois modos, em vez de inventar uma variante nova.
  const onMedia = Boolean(mediaUrl);
  const textToneClass = onMedia ? "text-primary-foreground" : "text-foreground";
  const mutedToneClass = onMedia ? "text-primary-foreground/80" : "text-muted-foreground";

  return (
    <div id={block.htmlId ?? undefined} className="relative overflow-hidden rounded-panel">
      {mediaUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- mesmo padrão do resto do page-builder, sem domínio remoto configurado pra next/image
        <img src={mediaUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      )}
      {mediaUrl && overlay && <div aria-hidden className={cn("absolute inset-0", overlay)} />}
      <div
        className={cn(
          "relative flex flex-col gap-4 px-6 py-16 sm:px-10 sm:py-24",
          align === "center" ? "items-center text-center" : "items-start text-start",
          textToneClass,
        )}
      >
        {eyebrow && <p className={cn("text-xs font-semibold uppercase tracking-caps", mutedToneClass)}>{eyebrow}</p>}
        <h1 className="text-4xl font-semibold tracking-display sm:text-5xl">{title}</h1>
        {subtitle && <p className={cn("max-w-2xl text-base sm:text-lg", mutedToneClass)}>{subtitle}</p>}
        {(primaryLabel || secondaryLabel) && (
          <div className="mt-2 flex flex-wrap gap-3">
            {primaryLabel && primaryHref && (
              <Button asChild size="lg">
                <Link href={primaryHref}>{primaryLabel}</Link>
              </Button>
            )}
            {secondaryLabel && secondaryHref && (
              <Button asChild size="lg" variant={onMedia ? "secondary" : "outline"}>
                <Link href={secondaryHref}>{secondaryLabel}</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CTABlock({ block }: BlockRendererProps) {
  const data = block.data;
  const title = readString(data, "title");
  const description = readString(data, "description");
  const buttonLabel = readString(data, "buttonLabel");
  const buttonHref = readString(data, "buttonHref");
  const background = CTA_BACKGROUND_CLASSES[readString(data, "background", "muted")] ?? CTA_BACKGROUND_CLASSES.muted;
  const onPrimary = readString(data, "background", "muted") === "primary";

  return (
    <div className={cn("flex flex-col items-start gap-4 rounded-panel p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8", background)}>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-display sm:text-2xl">{title}</h2>
        {description && (
          <p className={cn("max-w-xl text-sm sm:text-base", onPrimary ? "text-primary-foreground/80" : "text-muted-foreground")}>
            {description}
          </p>
        )}
      </div>
      <Button asChild size="lg" variant={onPrimary ? "secondary" : "default"} className="shrink-0">
        <Link href={buttonHref}>{buttonLabel}</Link>
      </Button>
    </div>
  );
}

async function GalleryBlock({ block, renderBlocks }: BlockRendererProps) {
  const requestedColumns = Number(block.data.columns) || 3;
  const columns = CARD_GRID_COLUMN_CLASSES[requestedColumns] ? requestedColumns : 3;
  const gap = GAP_CLASSES[readString(block.data, "gap", "md")] ?? GAP_CLASSES.md;
  const area = readArea(block, "items");
  const content = area ? await renderBlocks(area.blocks) : [];

  return (
    <div id={block.htmlId ?? undefined} className={cn("grid", CARD_GRID_COLUMN_CLASSES[columns], gap)}>
      {content}
    </div>
  );
}

async function CarouselBlock({ block, renderBlocks }: BlockRendererProps) {
  const area = readArea(block, "items");
  const slides = area ? await renderBlocks(area.blocks) : [];
  if (slides.length === 0) {
    return null;
  }

  return (
    <CarouselBlockClient
      slides={slides}
      autoplay={block.data.autoplay === true}
      interval={Number(block.data.interval) || 5}
      loop={block.data.loop !== false}
      showDots={block.data.showDots !== false}
      htmlId={block.htmlId}
    />
  );
}

const CORE_BLOCK_RENDERERS: Record<string, BlockRendererComponent> = {
  [ROW_BLOCK_KEY]: RowBlock,
  "core.content.heading": HeadingBlock,
  "core.content.richtext": RichtextBlock,
  "core.content.image": ImageBlock,
  "core.content.button": ButtonBlock,
  "core.layout.spacer": SpacerBlock,
  "core.layout.divider": DividerBlock,
  "core.content.icon": IconBlock,
  "core.content.badge": BadgeBlock,
  "core.content.quote": QuoteBlock,
  "core.content.alert": AlertBlockRenderer,
  "core.content.list": ListBlock,
  "core.content.progress": ProgressBlockRenderer,
  "core.content.card": CardBlock,
  "core.content.audio": AudioBlock,
  "core.layout.section": SectionBlock,
  "core.layout.accordion": AccordionBlock,
  "core.layout.accordion-item": AccordionItemBlock,
  "core.layout.tabs": TabsBlock,
  "core.layout.tabs-item": TabsItemBlock,
  "core.layout.card-grid": CardGridBlock,
  [HERO_BLOCK_KEY]: HeroBlock,
  [CTA_BLOCK_KEY]: CTABlock,
  [GALLERY_BLOCK_KEY]: GalleryBlock,
  [CAROUSEL_BLOCK_KEY]: CarouselBlock,
};

// Renderers de plugin vêm de PLUGIN_CONTRIBUTIONS[key].blockRenderers — um LOADER preguiçoso
// (`() => import("./blocks/renderers")`), porque a árvore de componentes de render sobe até
// @/contexts/auth -> next-auth e não pode entrar no grafo estático de quem só lê
// breadcrumbs/seeds. Este módulo é "server-only", então resolver os renderers de forma assíncrona
// aqui é seguro (nunca cruza o boundary RSC). O gate por plugin ATIVO fica no dispatch de render
// (components/page-builder/block-renderer.tsx, via pluginKeyForBlockKey + getActivePluginKeys):
// este mapa é só o superset chaveado por block key, e uma entrada de plugin desativado aqui é
// inerte porque renderBlock nunca chega a resolvê-la.
let cachedRenderers: Promise<Record<string, BlockRendererComponent>> | null = null;

async function loadAllBlockRenderers(): Promise<Record<string, BlockRendererComponent>> {
  const pluginMaps = await Promise.all(
    Object.values(PLUGIN_CONTRIBUTIONS).map((contributions) =>
      contributions.blockRenderers ? contributions.blockRenderers() : Promise.resolve({}),
    ),
  );
  return Object.assign({}, CORE_BLOCK_RENDERERS, ...pluginMaps);
}

function getAllBlockRenderers(): Promise<Record<string, BlockRendererComponent>> {
  if (!cachedRenderers) {
    cachedRenderers = loadAllBlockRenderers();
  }
  return cachedRenderers;
}

export async function resolveBlockRenderer(key: string): Promise<BlockRendererComponent | null> {
  return (await getAllBlockRenderers())[key] ?? null;
}

export async function listBlockRendererKeys(): Promise<string[]> {
  return Object.keys(await getAllBlockRenderers());
}
