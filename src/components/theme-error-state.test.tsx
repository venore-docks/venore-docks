// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import type { ClientErrorStateProps } from "@/contexts/themes/contracts/v8";

// Escada de erro (spec v8 §6, W4): SSR/primeiro render = ErrorState do kit (sem tocar em
// `document`); depois do mount lê data-theme e carrega o ErrorState do "<pkg>/theme-client".
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const loads = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/themes/registry.client.generated", () => ({
  THEME_CLIENT_REGISTRY: {
    aurora: async () => {
      loads.count += 1;
      return {
        ErrorState: ({ strings, reset }: ClientErrorStateProps) => (
          <button type="button" onClick={reset}>
            aurora: {strings["error.title"]}
          </button>
        ),
      };
    },
  },
}));

const { ThemeErrorState } = await import("./theme-error-state");

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.getElementById("theme-strings")?.remove();
  loads.count = 0;
});

describe("ThemeErrorState", () => {
  it("SSR usa o ErrorState do kit em pt-BR", () => {
    const html = renderToString(<ThemeErrorState error={new Error("x")} reset={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Algo deu errado");
    expect(loads.count).toBe(0);
  });

  it("depois do mount troca pelo ErrorState do tema com as strings do layout", async () => {
    document.documentElement.dataset.theme = "aurora";
    const script = document.createElement("script");
    script.id = "theme-strings";
    script.type = "application/json";
    script.textContent = JSON.stringify({ "error.title": "Something went wrong" });
    document.body.appendChild(script);

    const reset = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(<ThemeErrorState error={new Error("x")} reset={reset} />);
    });
    expect(loads.count).toBe(1);
    expect(container.textContent).toBe("aurora: Something went wrong");
    act(() => container.querySelector("button")!.click());
    expect(reset).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it("tema sem theme-client fica no kit", async () => {
    document.documentElement.dataset.theme = "venore-slime";
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(<ThemeErrorState error={new Error("x")} reset={() => {}} />);
    });
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    act(() => root.unmount());
  });
});
