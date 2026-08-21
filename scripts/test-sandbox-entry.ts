// Test entry v2: bypass File/Blob realm issues — feed JSZip a sandbox-realm
// Uint8Array directly. Verifies JSZip core + setimmediate shim + pako work
// in a no-global/no-process environment.
import JSZip from "jszip";

(globalThis as unknown as Record<string, unknown>).__testZip = async () => {
  const zip = new JSZip();
  zip.file("test.stp", new Uint8Array(40), {
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  const blob = await zip.generateAsync({
    type: "blob",
    platform: "UNIX",
    mimeType: "application/zip",
  });
  return { size: blob.size, ok: blob.size > 0 };
};
