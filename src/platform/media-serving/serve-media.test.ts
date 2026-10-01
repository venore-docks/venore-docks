import { describe, expect, it } from "vitest";
import { parseRangeHeader } from "./serve-media";

describe("parseRangeHeader", () => {
  it("parses explicit, open-ended and suffix ranges", () => {
    expect(parseRangeHeader("bytes=0-99")).toEqual({ start: 0, end: 99 });
    expect(parseRangeHeader("bytes=100-")).toEqual({ start: 100, end: null });
    expect(parseRangeHeader("bytes=-500")).toEqual({ start: null, end: 500 });
  });

  it("ignores malformed or multi-range headers", () => {
    expect(parseRangeHeader("bytes=0-1,5-6")).toBeNull();
    expect(parseRangeHeader("items=0-1")).toBeNull();
    expect(parseRangeHeader(null)).toBeNull();
  });
});
