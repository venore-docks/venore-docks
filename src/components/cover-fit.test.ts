import { describe, expect, it } from "vitest";
import { resolveCoverFit } from "./cover-fit";

describe("resolveCoverFit", () => {
  it("mostra inteira a arte vertical, quadrada e de story", () => {
    expect(resolveCoverFit(1080, 1350)).toBe("contain");
    expect(resolveCoverFit(1080, 1080)).toBe("contain");
    expect(resolveCoverFit(1013, 1800)).toBe("contain");
    expect(resolveCoverFit(1080, 900)).toBe("contain");
  });

  it("mantém object-cover em foto horizontal", () => {
    expect(resolveCoverFit(1600, 1067)).toBe("cover");
    expect(resolveCoverFit(1280, 720)).toBe("cover");
    expect(resolveCoverFit(1262, 835)).toBe("cover");
  });

  it("sem dimensão conhecida, comportamento antigo (cover)", () => {
    expect(resolveCoverFit(null, null)).toBe("cover");
    expect(resolveCoverFit(undefined, 800)).toBe("cover");
    expect(resolveCoverFit(0, 0)).toBe("cover");
  });
});
