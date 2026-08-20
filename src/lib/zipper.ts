/**
 * ZIP creation using JSZip (mature library, no hand-rolled ZIP format).
 * - Deflate, fixed compression level 6
 * - UTF-8 file names
 * - ZIP64 handled automatically by JSZip when needed
 */
import JSZip from "jszip";
import { zipFileName } from "./config.js";

const COMPRESSION_LEVEL = 6;

/**
 * Create a ZIP blob containing exactly one file: the original attachment.
 * ZIP name: "<originalName>.zip"; inner entry name: the original file name.
 */
export async function zipFile(file: File): Promise<Blob> {
  const zip = new JSZip();
  // Convert to ArrayBuffer: JSZip's Blob handling relies on the browser
  // FileReader, which does not exist in Node (used by unit tests). File and
  // Blob both expose arrayBuffer() in every supported environment.
  const data = await file.arrayBuffer();
  zip.file(file.name, data, {
    compression: "DEFLATE",
    compressionOptions: { level: COMPRESSION_LEVEL },
  });
  return zip.generateAsync({
    type: "blob",
    platform: "UNIX",
    mimeType: "application/zip",
  });
}

export { zipFileName };
