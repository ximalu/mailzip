import { describe, expect, it } from "vitest";
import {
  BYTES_PER_MIB,
  extensionOf,
  parseExtensions,
  parseThresholdBytes,
  shouldCompress,
  zipFileName,
  type MailZipConfig,
} from "../src/lib/config.js";

const cfg = (over: Partial<MailZipConfig> = {}): MailZipConfig => ({
  extensions: ["stp", "step", "dwg", "dxf"],
  thresholdBytes: 1 * BYTES_PER_MIB,
  mode: "auto",
  timing: "on-send",
  language: "en",
  ...over,
});

describe("parseExtensions", () => {
  it("splits comma-separated extensions", () => {
    expect(parseExtensions("stp, step, dwg, dxf")).toEqual([
      "stp",
      "step",
      "dwg",
      "dxf",
    ]);
  });

  it("handles leading dots", () => {
    expect(parseExtensions(".stp,.step")).toEqual(["stp", "step"]);
  });

  it("normalizes case to lowercase", () => {
    expect(parseExtensions("STP, Step, Dwg")).toEqual(["stp", "step", "dwg"]);
  });

  it("handles spaces and mixed separators", () => {
    expect(parseExtensions("stp step,dwg , dxf")).toEqual([
      "stp",
      "step",
      "dwg",
      "dxf",
    ]);
  });

  it("handles full-width commas", () => {
    expect(parseExtensions("stp，step")).toEqual(["stp", "step"]);
  });

  it("filters empty entries", () => {
    expect(parseExtensions("stp,,,  ,step")).toEqual(["stp", "step"]);
  });

  it("returns empty array for empty input", () => {
    expect(parseExtensions("")).toEqual([]);
    expect(parseExtensions("   ")).toEqual([]);
  });

  it("handles multiple leading dots", () => {
    expect(parseExtensions("..stp")).toEqual(["stp"]);
  });
});

describe("parseThresholdBytes", () => {
  it("parses integer MiB", () => {
    expect(parseThresholdBytes("1")).toBe(1 * BYTES_PER_MIB);
    expect(parseThresholdBytes("2")).toBe(2 * BYTES_PER_MIB);
  });

  it("parses decimal MiB", () => {
    expect(parseThresholdBytes("1.5")).toBe(Math.round(1.5 * BYTES_PER_MIB));
    expect(parseThresholdBytes("0.5")).toBe(Math.round(0.5 * BYTES_PER_MIB));
  });

  it("returns 0 for invalid input", () => {
    expect(parseThresholdBytes("")).toBe(0);
    expect(parseThresholdBytes("abc")).toBe(0);
    expect(parseThresholdBytes("-1")).toBe(0);
    expect(parseThresholdBytes("NaN")).toBe(0);
  });
});

describe("extensionOf", () => {
  it("extracts lowercase extension", () => {
    expect(extensionOf("drawing.STP")).toBe("stp");
    expect(extensionOf("model.step")).toBe("step");
  });

  it("handles multi-dot names (takes last)", () => {
    expect(extensionOf("archive.tar.gz")).toBe("gz");
    expect(extensionOf("a.b.c.dwg")).toBe("dwg");
  });

  it("handles names without extension", () => {
    expect(extensionOf("noext")).toBe("");
    expect(extensionOf("trailing.")).toBe("");
  });
});

describe("shouldCompress", () => {
  it("compresses when extension matches AND size > threshold", () => {
    expect(shouldCompress("2.stp", 2 * BYTES_PER_MIB, cfg())).toBe(true);
  });

  it("does NOT compress when extension matches but size == threshold", () => {
    // strictly greater, not >=
    expect(shouldCompress("2.stp", 1 * BYTES_PER_MIB, cfg())).toBe(false);
  });

  it("does NOT compress when extension matches but size < threshold", () => {
    expect(shouldCompress("2.stp", 0.5 * BYTES_PER_MIB, cfg())).toBe(false);
  });

  it("does NOT compress when size > threshold but extension does not match", () => {
    expect(shouldCompress("1.jpg", 10 * BYTES_PER_MIB, cfg())).toBe(false);
    expect(shouldCompress("3.png", 10 * BYTES_PER_MIB, cfg())).toBe(false);
  });

  it("is case-insensitive on file extension", () => {
    expect(shouldCompress("2.STP", 2 * BYTES_PER_MIB, cfg())).toBe(true);
    expect(shouldCompress("2.Stp", 2 * BYTES_PER_MIB, cfg())).toBe(true);
  });

  it("never compresses when no extensions configured", () => {
    expect(shouldCompress("2.stp", 100 * BYTES_PER_MIB, cfg({ extensions: [] }))).toBe(false);
  });

  it("never compresses when threshold is 0 (size > 0 required)", () => {
    expect(shouldCompress("2.stp", 0, cfg({ thresholdBytes: 0 }))).toBe(false);
  });

  it("compresses files with no size info only if > threshold (size 0 never matches)", () => {
    expect(shouldCompress("2.stp", 0, cfg())).toBe(false);
  });
});

describe("zipFileName", () => {
  it("appends .zip to the original name", () => {
    expect(zipFileName("2.stp")).toBe("2.stp.zip");
    expect(zipFileName("model.step")).toBe("model.step.zip");
  });

  it("keeps the original name intact (not just the extension)", () => {
    expect(zipFileName("report 2024.dwg")).toBe("report 2024.dwg.zip");
  });
});
