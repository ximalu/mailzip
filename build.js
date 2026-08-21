/**
 * Build script: bundle TypeScript entry points with esbuild, copy static
 * assets into dist/.
 *
 * Output is self-contained IIFE bundles (Thunderbird MV2 background scripts
 * and options/ask pages don't use ES modules).
 */
import { build } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

mkdirSync("dist", { recursive: true });

const entries = [
  ["src/background.ts", "dist/background.js"],
  ["src/options.ts", "dist/options.js"],
  ["src/ask.ts", "dist/ask.js"],
];

/**
 * JSZip's package.json maps its main entry to a pre-bundled dist file
 * (browser field), which inlines the npm "setimmediate" package — that
 * polyfill contains `new Function` and trips the AMO validator
 * (DANGEROUS_EVAL). We force esbuild to use the source entry
 * (mainFields without "browser") and alias the Node-only dependencies to
 * safe shims:
 *   - setimmediate      → setTimeout-based shim (no eval)
 *   - readable-stream   → empty shim (nodestream detection returns false)
 *   - stream            → same empty shim
 */
const SET_IMMEDIATE_SHIM = fileURLToPath(
  new URL("./src/lib/setimmediate-shim.cjs", import.meta.url),
);
const READABLE_STREAM_SHIM = fileURLToPath(
  new URL("./src/lib/readable-stream-shim.cjs", import.meta.url),
);

for (const [entry, outfile] of entries) {
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "iife",
    target: "es2022",
    sourcemap: false,
    logLevel: "warning",
    // neutral: esbuild's browser platform applies package.json "browser"
    // field mappings even without "browser" in mainFields (0.24 behaviour),
    // which pulls in JSZip's pre-bundled dist file. neutral skips it.
    platform: "neutral",
    mainFields: ["module", "main"],
    alias: {
      setimmediate: SET_IMMEDIATE_SHIM,
      "readable-stream": READABLE_STREAM_SHIM,
      stream: READABLE_STREAM_SHIM,
    },
  });
  console.log(`built ${outfile}`);
}

cpSync("src/options.html", "dist/options.html");
cpSync("src/ask.html", "dist/ask.html");
cpSync("src/icons", "dist/icons", { recursive: true });
cpSync("manifest.json", "dist/manifest.json");
console.log("static assets copied");
