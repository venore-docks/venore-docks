"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type TurnstileApi = { render: (element: HTMLElement, options: Record<string, unknown>) => string; reset: (id?: string) => void };
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// Casca interativa do bloco "Formulário de contato" (o renderer server-only entrega o token
// cifrado do destinatário). Turnstile só carrega quando há site key configurada.
export function ContactFormClient({
  token,
  submitLabel,
  successMessage,
  turnstileSiteKey,
}: {
  token: string;
  submitLabel: string;
  successMessage: string;
  turnstileSiteKey: string | null;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!turnstileSiteKey || !widgetRef.current) return;
    const mount = () => {
      if (!window.turnstile || !widgetRef.current || widgetId.current) return;
      widgetId.current = window.turnstile.render(widgetRef.current, {
        sitekey: turnstileSiteKey,
        callback: (value: string) => setCaptchaToken(value),
        "expired-callback": () => setCaptchaToken(null),
      });
    };
    if (window.turnstile) {
      mount();
      return;
    }
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.onload = mount;
    document.head.appendChild(script);
  }, [turnstileSiteKey]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("sending");
    setError(null);
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        name: form.get("name"),
        email: form.get("email"),
        message: form.get("message"),
        website: form.get("website"),
        turnstileToken: captchaToken,
      }),
    }).catch(() => null);
    const body = (await response?.json().catch(() => null)) as { error?: string } | null;
    if (response?.ok) {
      setStatus("sent");
      return;
    }
    setStatus("idle");
    setError(body?.error ?? "Não foi possível enviar agora. Tente de novo.");
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }

  if (status === "sent") {
    return (
      <p role="status" className="rounded-md border border-border bg-accent/14 px-3 py-2 text-sm text-foreground">
        {successMessage}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="name" placeholder="Seu nome" autoComplete="name" maxLength={120} required aria-label="Seu nome" />
        <Input name="email" type="email" placeholder="Seu e-mail" autoComplete="email" maxLength={320} required aria-label="Seu e-mail" />
      </div>
      <Textarea name="message" placeholder="Sua mensagem" rows={5} maxLength={5000} required aria-label="Sua mensagem" />
      {/* Honeypot: fora da tela e fora da navegação por teclado. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -start-[9999px] h-0 w-0 opacity-0" />
      {turnstileSiteKey && <div ref={widgetRef} />}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={status === "sending" || (Boolean(turnstileSiteKey) && !captchaToken)}>
        {status === "sending" ? "Enviando..." : submitLabel}
      </Button>
    </form>
  );
}
