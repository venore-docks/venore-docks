import { describe, expect, it } from "vitest";
import { parseFaqItems, parseStatItems, parseTableRows, parseTimelineItems } from "./text-block-parsers";

describe("text block parsers", () => {
  it("table pads short rows", () => {
    expect(parseTableRows("A | B | C\n1 | 2\n\n")).toEqual([
      ["A", "B", "C"],
      ["1", "2", ""],
    ]);
  });

  it("faq splits on blank lines and keeps multi-line answers", () => {
    expect(parseFaqItems("Como faço?\nAssim.\nE assim.\n\nSem resposta\n\nOutra?\nSim.")).toEqual([
      { question: "Como faço?", answer: "Assim.\nE assim." },
      { question: "Outra?", answer: "Sim." },
    ]);
  });

  it("stats and timeline read pipe-separated columns", () => {
    expect(parseStatItems("1.200 | alunos\n98%")).toEqual([
      { value: "1.200", label: "alunos" },
      { value: "98%", label: "" },
    ]);
    expect(parseTimelineItems("2020 | Fundação | Começo | de tudo")).toEqual([
      { date: "2020", title: "Fundação", description: "Começo | de tudo" },
    ]);
  });
});
