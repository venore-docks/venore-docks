"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ThemeConfigDocument, ThemeConfigRevisionView } from "@/contexts/themes/contracts/v8";
import type { ThemeCustomizeChoice, ThemeCustomizeThemeView } from "@/platform/theme-engine/theme-config";
import { PREVIEW_BRIDGE_READY } from "@/theme-sdk/kit/preview-bridge";
import {
  discardThemeDraftAction,
  publishThemeDraftAction,
  saveThemeDraftAction,
  startThemePreviewAction,
  type ConfigActionState,
} from "../../_actions/config";
import { AssetsPanel } from "../_panels/assets-panel";
import { FontsPanel } from "../_panels/fonts-panel";
import { OptionsPanel } from "../_panels/options-panel";
import { PalettePanel } from "../_panels/palette-panel";
import { SectionsPanel } from "../_panels/sections-panel";
import { ThemePanel } from "../_panels/theme-panel";
import { NATIVE_FIELD_CLASS } from "./field-styles";
import { buildPreviewMessage } from "./preview-message";
import { DEFAULT_DATE_LOCALE, formatDate } from "@/shared/format-date";

// Mudanças que mexem na estrutura (tema, seções, assets, layout/mobileNav reservados, fontes — as
// classes do next/font e o CSS --theme-font-* saem do servidor) não dá pra pré-visualizar no
// client: salvam o rascunho e recarregam o iframe (spec §7.2).
const STRUCTURAL_KEYS: readonly (keyof ThemeConfigDocument)[] = ["themeKey", "sections", "assets"];
const RESERVED_OPTION_KEYS = ["layout", "mobile-nav", "contextual-bar"];

function isStructural(previous: ThemeConfigDocument, patch: Partial<ThemeConfigDocument>): boolean {
  if (STRUCTURAL_KEYS.some((key) => key in patch)) return true;
  if (!patch.byTheme) return false;
  const previousEntry = previous.byTheme[previous.themeKey];
  // Patch sem o tema atual (merge raso) não mexe nele.
  if (!(previous.themeKey in patch.byTheme)) return false;
  const nextEntry = patch.byTheme[previous.themeKey];
  if (JSON.stringify(previousEntry?.fonts ?? {}) !== JSON.stringify(nextEntry?.fonts ?? {})) return true;
  const before = previousEntry?.options ?? {};
  const after = nextEntry?.options ?? {};
  return RESERVED_OPTION_KEYS.some((key) => before[key] !== after[key]);
}

// Painéis devolvem `byTheme` com as entradas que mudaram: merge raso por tema, pra um patch nunca
// apagar a entrada de outro tema.
function applyPatch(previous: ThemeConfigDocument, patch: Partial<ThemeConfigDocument>): ThemeConfigDocument {
  const next = { ...previous, ...patch };
  if (patch.byTheme) next.byTheme = { ...previous.byTheme, ...patch.byTheme };
  return next;
}

export function CustomizeWorkspace({
  initialDocument,
  draft,
  storageUnavailable,
  themes,
  theme,
}: {
  initialDocument: ThemeConfigDocument;
  draft: ThemeConfigRevisionView | null;
  storageUnavailable: boolean;
  themes: ThemeCustomizeChoice[];
  theme: ThemeCustomizeThemeView;
}) {
  const router = useRouter();
  const [document, setDocument] = useState(initialDocument);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<ConfigActionState>({ error: null, warnings: [], done: false });
  const [previewPath, setPreviewPath] = useState("/");
  const [frameSrc, setFrameSrc] = useState<string | null>(draft ? null : "/");
  const [pending, startTransition] = useTransition();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const documentRef = useRef(document);
  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  // Volta a sincronizar com o servidor quando a página recarrega com outro rascunho/tema
  // (ajuste de estado durante o render, padrão do React para "prop mudou").
  const [syncedDocument, setSyncedDocument] = useState(initialDocument);
  if (syncedDocument !== initialDocument) {
    setSyncedDocument(initialDocument);
    setDocument(initialDocument);
    setDirty(false);
  }

  const reloadFrame = useCallback((path: string) => setFrameSrc(`${path}${path.includes("?") ? "&" : "?"}_preview=${Date.now()}`), []);

  // Com rascunho existente, liga o cookie de preview dele antes de carregar o iframe (uma vez por
  // rascunho: salvar de novo mantém o id e não recarrega o iframe por aqui).
  const draftId = draft?.id ?? null;
  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    void startThemePreviewAction().then((result) => {
      if (cancelled) return;
      if (result.error) setStatus(result);
      reloadFrame("/");
    });
    return () => {
      cancelled = true;
    };
  }, [draftId, reloadFrame]);

  const postPreview = useCallback(
    (next: ThemeConfigDocument) => {
      frameRef.current?.contentWindow?.postMessage(buildPreviewMessage(next, theme.options), window.location.origin);
    },
    [theme.options],
  );

  // O bridge avisa quando montou (a cada recarga do iframe): reenvia o estado não salvo.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if ((event.data as { type?: unknown })?.type === PREVIEW_BRIDGE_READY) postPreview(documentRef.current);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [postPreview]);

  const save = useCallback(
    (next: ThemeConfigDocument) =>
      startTransition(async () => {
        const formData = new FormData();
        formData.set("config", JSON.stringify(next));
        const result = await saveThemeDraftAction({ error: null, warnings: [], done: false }, formData);
        setStatus(result);
        if (result.done) {
          setDirty(false);
          reloadFrame(previewPath);
          router.refresh();
        }
      }),
    [previewPath, reloadFrame, router],
  );

  const onChange = useCallback(
    (patch: Partial<ThemeConfigDocument>) => {
      const previous = documentRef.current;
      const next = applyPatch(previous, patch);
      documentRef.current = next;
      setDocument(next);
      if (isStructural(previous, patch)) {
        save(next);
      } else {
        setDirty(true);
        postPreview(next);
      }
    },
    [postPreview, save],
  );

  const runAction = (action: () => Promise<ConfigActionState>) =>
    startTransition(async () => {
      const result = await action();
      setStatus(result);
      if (result.done) {
        setDirty(false);
        router.refresh();
        reloadFrame(previewPath);
      }
    });

  // Publicar leva junto o que ainda não foi salvo: salva o rascunho antes, se preciso.
  const publish = () =>
    runAction(async () => {
      if (dirty) {
        const formData = new FormData();
        formData.set("config", JSON.stringify(documentRef.current));
        const saved = await saveThemeDraftAction({ error: null, warnings: [], done: false }, formData);
        if (!saved.done) return saved;
      }
      return publishThemeDraftAction();
    });

  const panelProps = { draft: document, theme, onChange };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex w-full flex-col gap-4 lg:w-96 lg:shrink-0">
        {storageUnavailable && (
          <p role="alert" className="rounded-panel border border-warning-border bg-warning-soft ui-panel-padding text-sm text-warning">
            A tabela de rascunhos ainda não existe neste ambiente (migration pendente). O site continua normal, mas não dá
            para salvar rascunhos aqui.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={pending || storageUnavailable} onClick={() => save(document)}>
            {dirty ? "Salvar rascunho" : "Salvar e recarregar"}
          </Button>
          <Button size="sm" variant="secondary" disabled={pending || storageUnavailable || (!draft && !dirty)} onClick={publish}>
            Publicar
          </Button>
          <Button size="sm" variant="outline" disabled={pending || !draft} onClick={() => runAction(discardThemeDraftAction)}>
            Descartar rascunho
          </Button>
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {pending
            ? "Salvando…"
            : dirty
              ? "Alterações ainda não salvas no rascunho (a pré-visualização já mostra cores e opções)."
              : draft
                ? `Rascunho salvo em ${formatDate(draft.createdAt, DEFAULT_DATE_LOCALE, "dateTimeSeconds")}.`
                : "Sem rascunho: a primeira alteração estrutural cria um."}
        </p>
        {status.error && (
          <p role="alert" className="text-sm text-destructive">
            {status.error}
          </p>
        )}
        {status.warnings.length > 0 && (
          <ul className="list-disc space-y-1 ps-5 text-xs text-warning">
            {status.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
        <ThemePanel {...panelProps} themes={themes} />
        <PalettePanel {...panelProps} />
        <OptionsPanel {...panelProps} />
        <FontsPanel {...panelProps} />
        <SectionsPanel {...panelProps} themes={themes} />
        <AssetsPanel {...panelProps} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            reloadFrame(previewPath.startsWith("/") ? previewPath : `/${previewPath}`);
          }}
        >
          <label className="sr-only" htmlFor="customize-preview-path">
            Página da pré-visualização
          </label>
          <input
            id="customize-preview-path"
            className={NATIVE_FIELD_CLASS}
            value={previewPath}
            onChange={(event) => setPreviewPath(event.target.value)}
            placeholder="/"
          />
          <Button type="submit" size="sm" variant="outline">
            Abrir
          </Button>
        </form>
        <div className="overflow-hidden rounded-panel border border-border bg-background">
          {frameSrc ? (
            <iframe ref={frameRef} title="Pré-visualização do site" src={frameSrc} className="h-[70vh] w-full lg:h-[calc(100vh-14rem)]" />
          ) : (
            <p className="ui-panel-padding text-sm text-muted-foreground">Carregando pré-visualização…</p>
          )}
        </div>
      </div>
    </div>
  );
}
