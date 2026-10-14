"use client";

import { Component, type ReactNode } from "react";

// Boundary de cada contribuição de outlet de plugin (spec v8 §7.4): um outlet que lança no client
// some (renderiza null) em vez de derrubar a região. Dono: W7.
export class OutletErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
