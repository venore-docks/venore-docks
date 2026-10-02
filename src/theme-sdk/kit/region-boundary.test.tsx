// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { RegionBoundary } from "./region-boundary";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Boom(): never {
  throw new Error("override quebrado");
}

// Client: override de região que lança ao renderizar no navegador cai na região do kit.
describe("RegionBoundary (client)", () => {
  it("renderiza o fallback (região do kit) quando o override lança", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const container = document.createElement("div");
    const root = createRoot(container, { onCaughtError: () => {} });
    act(() =>
      root.render(
        <RegionBoundary region="footer" fallback={<footer id="kit">kit</footer>}>
          <Boom />
        </RegionBoundary>,
      ),
    );
    expect(container.innerHTML).toBe('<footer id="kit">kit</footer>');
    act(() => root.unmount());
    errors.mockRestore();
  });

  it("sem erro, renderiza o override", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() =>
      root.render(
        <RegionBoundary fallback={<footer>kit</footer>}>
          <footer>tema</footer>
        </RegionBoundary>,
      ),
    );
    expect(container.innerHTML).toBe("<footer>tema</footer>");
    act(() => root.unmount());
  });
});
