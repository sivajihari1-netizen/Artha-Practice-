import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

// Explicit config, added because Vitest's implicit tsconfig-paths discovery
// (relied on until now, with no vitest.config.* at all) turned out to be
// incomplete: it resolved "@/lib/*" correctly only for modules that
// happened to already be reachable from some previously-tested file's
// dependency graph. Two real, pre-existing source modules
// (src/lib/recurrence.ts, src/lib/complianceRules.ts) — never before
// imported by any test, but imported by production code all along — failed
// to resolve with "Cannot find package '@/lib/recurrence'" even in complete
// isolation, with no test-code changes involved. `tsc --noEmit` and
// `next build` both resolve these files fine, confirming it was Vitest's
// resolution specifically, not a real problem with the source. An explicit
// alias removes the guesswork. `.mts` (not `.ts`) so Vite doesn't have to
// guess at ESM-vs-CommonJS for this file — the rest of the package.json has
// no "type": "module", intentionally left untouched.
export default defineConfig({
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
  // tsconfig.json sets "jsx": "preserve" (Next.js's own compiler does the
  // real JSX transform at build time) — Vite 8's default oxc transformer
  // inherits that and refuses to parse .tsx files under test, breaking any
  // test that imports one, even a plain presentational component. Force
  // oxc's own transform for the test run only; tsconfig.json stays
  // untouched since Next's build depends on "preserve".
  oxc: {
    jsx: "automatic",
  },
});
