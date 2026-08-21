/**
 * Build script: bundle TypeScript entry points with esbuild, copy static
 * assets into dist/.
 *
 * Output is self-contained IIFE bundles (Thunderbird MV2 background scripts
 * and options/ask pages don't use ES modules).
 */
import { build } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });

const entries = [
  ["src/background.ts", "dist/background.js"],
  ["src/options.ts", "dist/options.js"],
  ["src/ask.ts", "dist/ask.js"],
];

for (const [entry, outfile] of entries) {
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "iife",
    target: "es2022",
    sourcemap: false,
    logLevel: "warning",
  });
  console.log(`built ${outfile}`);
}

cpSync("src/options.html", "dist/options.html");
cpSync("src/ask.html", "dist/ask.html");
cpSync("src/icons", "dist/icons", { recursive: true });
cpSync("manifest.json", "dist/manifest.json");
console.log("static assets copied");
