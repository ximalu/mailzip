/**
 * MailZip configuration: parsing, normalization and matching rules.
 *
 * Pure logic, no Thunderbird API dependencies — unit-testable in isolation.
 */

/** 1 MiB = 1,048,576 bytes (explicit definition, avoids ambiguity). */
export const BYTES_PER_MIB = 1_048_576;

export type CompressMode = "auto" | "ask";
export type CompressTiming = "on-send" | "on-add";
export type Language = "en" | "zh";

export interface MailZipConfig {
  /** Normalized extensions: lowercase, no leading dot. e.g. ["stp", "step"] */
  extensions: string[];
  /** Size threshold in bytes. Attachments strictly larger than this qualify. */
  thresholdBytes: number;
  mode: CompressMode;
  /** When to compress: before sending, or right after attachments are added. */
  timing: CompressTiming;
  /** UI language (default English; Chinese optional). */
  language: Language;
}

export const DEFAULT_THRESHOLD_MIB = 1;
export const DEFAULT_MODE: CompressMode = "auto";
export const DEFAULT_TIMING: CompressTiming = "on-send";
export const DEFAULT_LANGUAGE: Language = "en";

/**
 * Parse a raw extensions string into normalized lowercase dot-less extensions.
 *
 * Handles:
 *  - leading dots (".STP" -> "stp")
 *  - uppercase / mixed case ("STP", "Step" -> "stp", "step")
 *  - spaces, commas, full-width commas, mixed separators
 *  - empty entries (filtered out)
 */
export function parseExtensions(raw: string): string[] {
  return raw
    .split(/[,，\s]+/)
    .map((s) => s.trim().replace(/^\.+/, "").toLowerCase())
    .filter((s) => s.length > 0);
}

/**
 * Parse a user-entered MiB number (may contain decimals) into an integer
 * byte count. Returns 0 for invalid/empty input.
 */
export function parseThresholdBytes(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * BYTES_PER_MIB);
}

/** Format a byte count back to a human MiB string (1 decimal). */
export function formatMiB(bytes: number): string {
  return (bytes / BYTES_PER_MIB).toFixed(1);
}

/**
 * Extract the lowercase extension of a file name, without the dot.
 * "drawing.STP" -> "stp"; "archive.tar.gz" -> "gz"; "noext" -> "".
 */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

/**
 * Decide whether an attachment qualifies for zipping.
 * Both conditions must hold: extension matches AND size > threshold (strictly greater).
 */
export function shouldCompress(
  fileName: string,
  fileSizeBytes: number,
  cfg: MailZipConfig,
): boolean {
  if (cfg.extensions.length === 0) return false;
  const ext = extensionOf(fileName);
  if (!cfg.extensions.includes(ext)) return false;
  return fileSizeBytes > cfg.thresholdBytes;
}

/** ZIP file name for an original attachment: "<originalName>.zip" */
export function zipFileName(originalName: string): string {
  return `${originalName}.zip`;
}
