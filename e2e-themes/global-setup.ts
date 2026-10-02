import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { MANIFEST_PATH, readManifest, ROOT } from "./pages";
import { A11Y_RESULTS_DIR, SCREENSHOT_DIR } from "./ssr-output";

// O HTML vem do harness SSR — sem ele não há o que abrir.
export default function globalSetup() {
  if (!readManifest()) {
    throw new Error(
      `Sem ${path.relative(ROOT, MANIFEST_PATH)}. Rode antes o harness SSR: npx vitest run -c vitest.themes.config.ts src/themes/theme-ssr.harness.test.tsx`,
    );
  }
  for (const dir of [A11Y_RESULTS_DIR, SCREENSHOT_DIR]) {
    rmSync(path.join(ROOT, dir), { recursive: true, force: true });
    mkdirSync(path.join(ROOT, dir), { recursive: true });
  }
}
