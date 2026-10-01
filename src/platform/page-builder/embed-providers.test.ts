import { describe, expect, it } from "vitest";
import { parseEmbedUrl } from "./embed-providers";

describe("parseEmbedUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=1m30s", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://vimeo.com/76979871", "https://player.vimeo.com/video/76979871"],
    ["https://www.google.com/maps/embed?pb=!1m18!1m12", "https://www.google.com/maps/embed?pb=!1m18!1m12"],
    ["https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk?si=x", "https://open.spotify.com/embed/episode/4rOoJ6Egrf8K2IrywzwOMk"],
  ])("converts %s", (input, src) => {
    expect(parseEmbedUrl(input)?.src).toBe(src);
  });

  it.each([
    "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://evil.example/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=<script>",
    "https://www.google.com/search?q=maps",
    "javascript:alert(1)",
    "não é url",
  ])("refuses %s", (input) => {
    expect(parseEmbedUrl(input)).toBeNull();
  });
});
