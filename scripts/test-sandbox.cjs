#!/usr/bin/env node
/**
 * Simulate the Thunderbird extension environment (NO global, NO process,
 * but with self/globalThis/Promise/Blob/File/setTimeout) and run the bundled
 * zipFile to see whether JSZip's source build works there.
 */
"use strict";
const fs = require("fs");
const vm = require("vm");

// ---- build the test bundle with the SAME esbuild options as build.js ----
const esbuild = require("esbuild");
const { fileURLToPath } = require("url");

const SET_IMMEDIATE_SHIM = "./src/lib/setimmediate-shim.cjs";
const READABLE_STREAM_SHIM = "./src/lib/readable-stream-shim.cjs";

(async () => {
  await esbuild.build({
    entryPoints: ["./scripts/test-sandbox-entry.ts"],
    outfile: "/tmp/mailzip-sandbox-bundle.js",
    bundle: true,
    format: "iife",
    target: "es2022",
    sourcemap: false,
    logLevel: "silent",
    platform: "neutral",
    mainFields: ["module", "main"],
    define: { global: "globalThis", process: '{"browser":true}' },
    alias: {
      setimmediate: SET_IMMEDIATE_SHIM,
      "readable-stream": READABLE_STREAM_SHIM,
      stream: READABLE_STREAM_SHIM,
    },
  });
  console.log("bundle ok");

  // ---- build the sandbox: Thunderbird-like, WITHOUT global/process ----
  const code = fs.readFileSync("/tmp/mailzip-sandbox-bundle.js", "utf8");

  class FakeFile extends Blob {
    constructor(parts, name, opts) {
      super(parts, opts || {});
      this.name = name;
      this.lastModified = 0;
    }
  }

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Blob,
    File: FakeFile,
    TextEncoder: require("util").TextEncoder,
    TextDecoder: require("util").TextDecoder,
    URL,
    URLSearchParams,
    // NOTE: deliberately NO `global`, NO `process` — matches Thunderbird.
  };
  sandbox.self = sandbox;
  vm.createContext(sandbox);

  try {
    vm.runInContext(code, sandbox, { filename: "background-bundle.js" });
    const result = await sandbox.__testZip();
    console.log("ZIP TEST RESULT:", JSON.stringify(result));
    if (result.ok) {
      console.log("PASS: zipFile works in Thunderbird-like env");
      process.exit(0);
    } else {
      console.log("FAIL: zipFile returned empty");
      process.exit(1);
    }
  } catch (err) {
    console.error("ZIP TEST CRASHED:");
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
