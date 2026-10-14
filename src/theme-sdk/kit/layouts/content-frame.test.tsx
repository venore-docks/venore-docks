import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { ContentFrame, type ContextualMobileMode } from "./content-frame";
import { SkipLink } from "./skip-link";

// Moldura de conteúdo (spec v8 §2.5/§7.8): alvo do skip link, placement da barra contextual e o
// comportamento dela abaixo de lg (`contextualBarMobile`).
function frame(placement: "side" | "top" | "none", mobile: ContextualMobileMode = "bottom") {
  const html = renderToStaticMarkup(
    <ContentFrame breadcrumbs={null} contextualBar={<p id="bar">barra</p>} contextualPlacement={placement} contextualMobile={mobile}>
      <p id="page">página</p>
    </ContentFrame>,
  );
  return new JSDOM(`<body>${html}</body>`).window.document;
}

describe("ContentFrame", () => {
  it("<main id=conteudo> é o alvo do SkipLink", () => {
    const doc = frame("side");
    expect(doc.querySelector("main")!.id).toBe("conteudo");
    const skip = new JSDOM(renderToStaticMarkup(<SkipLink />)).window.document.querySelector("a")!;
    expect(skip.getAttribute("href")).toBe("#conteudo");
    expect(skip.textContent).toBe("Pular para o conteúdo");
    expect(skip.className).toContain("sr-only");
    expect(skip.className).toContain("focus:not-sr-only");
  });

  it("side (padrão): <aside> depois do <main>, ao lado a partir de lg", () => {
    const doc = frame("side");
    const row = doc.querySelector("main")!.parentElement!;
    expect(row.className).toContain("flex-col lg:flex-row");
    expect(doc.querySelector("main")!.nextElementSibling!.tagName).toBe("ASIDE");
    expect(doc.querySelector("aside")!.className).toContain("lg:w-72");
  });

  it("top: <aside> antes do <main>, largura total, sem virar coluna", () => {
    const doc = frame("top");
    const aside = doc.querySelector("aside")!;
    expect(aside.nextElementSibling!.tagName).toBe("MAIN");
    expect(aside.className).not.toContain("lg:w-72");
    expect(aside.parentElement!.className).not.toContain("lg:flex-row");
  });

  it("none: sem <aside>", () => {
    expect(frame("none").querySelector("aside")).toBeNull();
  });

  it("mobile hidden: <aside> só de lg pra cima", () => {
    expect(frame("side", "hidden").querySelector("aside")!.className).toContain("hidden lg:block");
    expect(frame("side", "hidden").querySelector("details")).toBeNull();
  });

  it("mobile top-collapsible: <details> antes do <main> abaixo de lg + <aside> só desktop", () => {
    const doc = frame("side", "top-collapsible");
    const details = doc.querySelector("details")!;
    expect(details.className).toContain("lg:hidden");
    expect(details.querySelector("summary")!.textContent).toBe("Nesta seção");
    expect(details.compareDocumentPosition(doc.querySelector("main")!) & 4).toBeTruthy(); // details antes do main
    expect(doc.querySelector("aside")!.className).toContain("hidden lg:block");
  });

  it("mobile bottom (padrão): markup do slime, sem <details>", () => {
    const doc = frame("side", "bottom");
    expect(doc.querySelector("details")).toBeNull();
    expect(doc.querySelector("aside")!.className).toBe("w-full shrink-0 text-foreground lg:w-72");
  });
});
