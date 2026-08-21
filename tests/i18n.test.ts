import { describe, expect, it } from "vitest";
import { LANGUAGES, messages, t } from "../src/lib/i18n.js";

describe("i18n", () => {
  it("en and zh have identical key sets", () => {
    const enKeys = Object.keys(messages.en).sort();
    const zhKeys = Object.keys(messages.zh).sort();
    expect(zhKeys).toEqual(enKeys);
  });

  it("every key has a non-empty value in every language", () => {
    for (const lang of LANGUAGES) {
      for (const [key, value] of Object.entries(messages[lang])) {
        expect(value.trim().length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("t returns the requested language", () => {
    expect(t("en", "save")).toBe("Save");
    expect(t("zh", "save")).toBe("保存");
  });

  it("t substitutes parameters", () => {
    const rendered = t("en", "previewConfigured", {
      exts: "stp, step",
      threshold: "1.0",
      bytes: "1048576",
    });
    expect(rendered).toContain("stp, step");
    expect(rendered).toContain("1048576");
  });

  it("missing key falls back to English", () => {
    // @ts-expect-error - testing runtime fallback for unknown keys
    expect(t("zh", "definitelyMissingKey")).toBe(
      // @ts-expect-error - same runtime probe
      messages.en.definitelyMissingKey,
    );
  });
});
