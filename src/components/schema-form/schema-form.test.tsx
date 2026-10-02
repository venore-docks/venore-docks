import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/media-picker-field", () => ({ MediaPickerField: ({ name }: { name: string }) => <span data-picker={name} /> }));
const { SchemaForm } = await import("./schema-form");

describe("SchemaForm", () => {
  it("renderiza todo tipo com label associado e nomes de FormData", () => {
    const html = renderToStaticMarkup(
      <SchemaForm
        idPrefix="f"
        fields={[
          { type: "boolean", name: "b", label: "Bool" },
          { type: "select", name: "s", label: "Sel", choices: [{ value: "a", label: "A" }], emptyLabel: "Padrão" },
          { type: "range", name: "r", label: "Faixa", min: 0, max: 2, step: 1, unit: "px", group: "G" },
          { type: "color", name: "c", label: "Cor", description: "dica" },
          { type: "text", name: "t", label: "Texto", maxLength: 5 },
          { type: "media", name: "m", label: "Mídia", accept: "image" },
          { type: "text", name: "h", label: "Oculto", visibleWhen: { name: "b", equals: true } },
        ]}
        values={{ b: false, s: "a", r: 1, c: "#aabbcc", t: "x", m: "id1", h: "keep" }}
        errors={{ t: "ruim" }}
      />,
    );
    for (const [id, name] of [["f-b", "b"], ["f-s", "s"], ["f-r", "r"], ["f-c", "c"], ["f-t", "t"]]) {
      expect(html).toContain(`for="${id}"`);
      expect(html).toContain(`id="${id}"`);
      expect(html).toMatch(new RegExp(`name="${name}"`));
    }
    expect(html).toContain('aria-describedby="f-c-description"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("<legend");
    expect(html).toContain('aria-labelledby="f-m-label"');
    expect(html).toContain('type="hidden" name="m" value="id1"');
    expect(html).toContain('type="hidden" name="h" value="keep"');
    expect(html).not.toContain('id="f-h"');
  });
});
