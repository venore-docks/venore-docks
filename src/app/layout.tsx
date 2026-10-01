import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ThemeDomSync } from "@/components/theme-dom-sync";
import { resolveThemeMetadataDefaults } from "@/platform/seo/metadata-defaults";
import { generateViewport as generateThemeViewport } from "@/platform/seo/viewport";
import { resolveDocumentModel } from "@/platform/theme-rendering/document-model";
import "./globals.css";

// Root layout — congelado depois da Fase F da v8 (spec §6). Toda variação de tema (definição,
// paleta, opções, fontes, locale, preview, seção) vem de resolveDocumentModel(), atrás de
// resolvers com dono; este arquivo só aplica o resultado no <html>.

// Viewport (themeColor etc.) e metadata padrão moram em platform/seo (dono W4). Wrapper em vez
// de re-export: o Next lê as exports especiais do arquivo de layout.
export async function generateViewport(): Promise<Viewport> {
  return generateThemeViewport();
}

export async function generateMetadata(): Promise<Metadata> {
  return resolveThemeMetadataDefaults();
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [doc, requestHeaders] = await Promise.all([resolveDocumentModel(), headers()]);
  // Nonce da CSP gerado por request em src/proxy.ts — o script inline do next-themes (evita o
  // flash de tema) precisa dele pra rodar quando a política estiver em "enforce".
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  const { manifest } = doc.theme;
  // CSS de runtime = override de paleta (catálogo do tema ou cor digitada pelo admin) + opções +
  // fontes. dangerouslySetInnerHTML só é seguro porque cada builder valida o que interpola
  // (cores contra hex/oklch estrito, nomes de token contra kebab-case) — nunca texto livre.
  const runtimeCss = doc.runtimeCss;

  // Tema single-mode (manifest.colorModes com um só valor): força esse modo no next-themes —
  // não há "outro" pra alternar. `forcedTheme` desabilita a troca; o ColorModeToggle lê isso e
  // some. Tema bimodal (o caso atual de todos): forcedColorMode fica undefined e nada muda.
  const forcedColorMode = manifest.colorModes.length === 1 ? manifest.colorModes[0] : undefined;

  return (
    <html
      lang={doc.locale}
      dir={doc.dir}
      data-theme={doc.theme.key}
      {...doc.htmlAttributes}
      className={`${doc.fonts.classNames} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* <style> em qualquer posição do body ainda aplica globalmente ao documento (não é
            escopado pela posição no DOM) — evita depender de suporte a <head> customizado em
            root layout do App Router (mesmo padrão de ChartStyle, src/components/ui/chart.tsx). */}
        {runtimeCss && <style id="theme-runtime" nonce={nonce} dangerouslySetInnerHTML={{ __html: runtimeCss }} />}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem forcedTheme={forcedColorMode} nonce={nonce}>
          <ThemeDomSync themeKey={doc.theme.key} attributes={doc.htmlAttributes} lang={doc.locale} dir={doc.dir} />
          {children}
          <Toaster />
          <ServiceWorkerRegistrar />
          <InstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}
