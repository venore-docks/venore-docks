"use client";

import { Component, type ReactNode } from "react";

// Error boundary de região (spec §6): override de região que lança no client cai no fallback (a
// região do kit já renderizada). No SSR quem segura é o <Suspense fallback> do ThemeRenderer.
// Dono: W3.
export class RegionBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
