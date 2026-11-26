"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, X } from "lucide-react";
import {
  PWA_DISMISSED_AT_KEY,
  PWA_INSTALLED_KEY,
  PWA_VISITS_KEY,
  shouldShowInstall,
  type InstallEnv,
  type PwaInstallSetting,
} from "@/platform/pwa/install-policy";

// Convite de instalação, discreto (pílula no canto), sem render no servidor nem antes da hidratação.
//  - Chrome/Android/desktop: guarda o `beforeinstallprompt` desta sessão (preventDefault) e oferece "Instalar".
//  - iOS/Safari: sem evento; só a instrução "Compartilhar > Adicionar à Tela de Início".
// A decisão é de `shouldShowInstall` (platform/pwa/install-policy.ts). Dispensar grava
// `pwa-install-dismissed-at`; instalar/aceitar grava `pwa-installed` e nunca mais mostra.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // localStorage indisponível: o convite pode reaparecer, mas nada quebra.
  }
}

// Conta 1 visita por sessão do navegador (sessionStorage evita contar recargas).
function countVisit(): number {
  let counted = false;
  try {
    counted = window.sessionStorage.getItem(PWA_VISITS_KEY) === "1";
    if (!counted) window.sessionStorage.setItem(PWA_VISITS_KEY, "1");
  } catch {
    counted = true;
  }
  const current = Number(readStorage(PWA_VISITS_KEY)) || 0;
  if (counted) return current;
  writeStorage(PWA_VISITS_KEY, String(current + 1));
  return current + 1;
}

function isStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    ["standalone", "minimal-ui", "window-controls-overlay"].some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches)
  );
}

export function InstallPrompt({ setting }: { setting: PwaInstallSetting }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [channel, setChannel] = useState<InstallEnv["channel"]>("none");
  const [ready, setReady] = useState(false);
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);
  const visits = useRef(0);

  useEffect(() => {
    visits.current = countVisit();
    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !("MSStream" in window);
    const timer = window.setTimeout(() => {
      if (ios) setChannel("ios");
      setReady(true);
    }, 0);
    function onBefore(event: Event) {
      event.preventDefault();
      deferred.current = event as BeforeInstallPromptEvent;
      setChannel("native");
    }
    function onInstalled() {
      writeStorage(PWA_INSTALLED_KEY, "1");
      deferred.current = null;
      setChannel("none");
      setVisible(false);
    }
    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const dismissedRaw = Number(readStorage(PWA_DISMISSED_AT_KEY));
    const show = shouldShowInstall({
      setting,
      pathname,
      isMobileViewport: window.matchMedia("(max-width: 1023px)").matches,
      standalone: isStandalone(),
      installed: readStorage(PWA_INSTALLED_KEY) === "1",
      dismissedAt: Number.isFinite(dismissedRaw) && dismissedRaw > 0 ? dismissedRaw : null,
      now: Date.now(),
      visitCount: visits.current,
      channel,
    });
    setVisible(show);
  }, [ready, channel, pathname, setting]);

  useEffect(() => {
    if (!visible) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        writeStorage(PWA_DISMISSED_AT_KEY, String(Date.now()));
        setVisible(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  if (!visible) return null;

  function dismiss() {
    writeStorage(PWA_DISMISSED_AT_KEY, String(Date.now()));
    setVisible(false);
  }

  async function install() {
    const event = deferred.current;
    if (!event) return;
    deferred.current = null; // o evento só serve uma vez
    setVisible(false);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === "accepted") writeStorage(PWA_INSTALLED_KEY, "1");
      else writeStorage(PWA_DISMISSED_AT_KEY, String(Date.now()));
    } catch {
      writeStorage(PWA_DISMISSED_AT_KEY, String(Date.now()));
    }
    setChannel("none");
  }

  const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div
      role="region"
      aria-label="Instalar aplicativo"
      className="fixed bottom-3 right-3 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-1 rounded-panel border border-border bg-card p-1 text-sm text-foreground shadow-float [margin-bottom:env(safe-area-inset-bottom)]"
    >
      {channel === "native" ? (
        <button
          type="button"
          onClick={install}
          aria-label="Instalar aplicativo na tela inicial"
          className={`inline-flex h-11 items-center gap-2 rounded-md px-3 font-medium text-primary ${focusRing}`}
        >
          <Download className="size-4 shrink-0" aria-hidden="true" />
          Instalar app
        </button>
      ) : (
        <p className="flex min-h-11 items-center gap-2 px-3 text-xs">
          <Share className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            Toque em <strong>Compartilhar</strong> &gt; <strong>Adicionar à Tela de Início</strong>
          </span>
        </p>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar convite de instalação"
        className={`inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground ${focusRing}`}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
