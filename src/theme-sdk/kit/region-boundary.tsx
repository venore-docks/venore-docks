"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

// Error boundary de região (spec §6): override de região que lança no client cai no fallback (a
// região do kit já renderizada). No SSR quem segura é o <Suspense fallback> do ThemeRenderer (o
// erro dentro dele vira o fallback e o client tenta de novo — e, se lançar de novo, cai aqui).
// Dono: W3.
export class RegionBoundary extends Component<
  { fallback: ReactNode; children: ReactNode; region?: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[theme] região "${this.props.region ?? "?"}" do tema falhou; usando a região do kit.`, error, info.componentStack);
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
