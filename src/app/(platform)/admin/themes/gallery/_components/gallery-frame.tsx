"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Moldura da galeria (spec v8 §7.13): o markup do tema é renderizado no servidor dentro de uma raiz
// escondida `<div hidden data-gallery-root data-theme=k …>` e copiado, já montado, para um
// <iframe srcdoc> com a largura pedida (390/1280) — media queries, `position: fixed`, ids e o modo
// claro/escuro valem DENTRO da moldura, sem vazar pro admin em volta. O iframe recebe as folhas de
// estilo do documento (CSS do app + o CSS de runtime com escopo `[data-gallery-root]`) e não roda
// script nenhum (sandbox sem allow-scripts): é uma vitrine estática, determinística.

type GalleryFrameProps = {
  title: string;
  // Largura em px; null = largura do container (conteúdo: templates, blocos, tokens).
  width: number | null;
  // Altura em px; null = cresce com o conteúdo.
  height: number | null;
  rootAttributes: Record<string, string>;
  rootClassName: string;
  children: ReactNode;
};

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function buildDocument(source: HTMLElement, rootAttributes: Record<string, string>, rootClassName: string): string {
  const styles = [...document.querySelectorAll<HTMLElement>('link[rel="stylesheet"], style')]
    .map((element) => element.outerHTML)
    .join("");
  const attributes = Object.entries(rootAttributes)
    .map(([name, value]) => (value === "" ? ` ${name}` : ` ${name}="${escapeAttribute(value)}"`))
    .join("");
  return [
    "<!DOCTYPE html>",
    `<html${attributes} class="${escapeAttribute(`${rootClassName} h-full antialiased`)}">`,
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base target="_blank">',
    styles,
    "</head>",
    `<body class="min-h-full flex flex-col bg-background text-foreground font-sans">${source.innerHTML}</body>`,
    "</html>",
  ].join("");
}

export function GalleryFrame({ title, width, height, rootAttributes, rootClassName, children }: GalleryFrameProps) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [autoHeight, setAutoHeight] = useState<number | null>(null);
  const attributesKey = JSON.stringify(rootAttributes);

  useEffect(() => {
    const source = sourceRef.current;
    if (!source) return;
    setSrcDoc(buildDocument(source, JSON.parse(attributesKey) as Record<string, string>, rootClassName));
  }, [attributesKey, rootClassName]);

  const fitContent = () => {
    if (height !== null) return;
    const document = frameRef.current?.contentDocument;
    if (document) setAutoHeight(document.documentElement.scrollHeight);
  };

  const frameStyle = { inlineSize: width ?? "100%", blockSize: height ?? autoHeight ?? 240 };

  return (
    <figure className="min-w-0 space-y-2">
      <figcaption className="flex flex-wrap items-baseline gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{title}</span>
        {width !== null ? <span>{width}px</span> : null}
      </figcaption>
      <div className="overflow-x-auto rounded-xl border border-border bg-muted">
        {srcDoc ? (
          <iframe
            ref={frameRef}
            title={`${title}${width !== null ? ` (${width}px)` : ""}`}
            srcDoc={srcDoc}
            sandbox="allow-same-origin"
            loading="lazy"
            onLoad={fitContent}
            className="block max-w-none border-0 bg-background"
            style={frameStyle}
          />
        ) : (
          <div aria-hidden="true" className="animate-pulse bg-muted" style={frameStyle} />
        )}
      </div>
      <div ref={sourceRef} hidden {...rootAttributes} className={rootClassName}>
        {children}
      </div>
    </figure>
  );
}
