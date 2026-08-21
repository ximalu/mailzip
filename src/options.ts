/**
 * MailZip options page: load/save the settings.
 *
 * All user-facing strings go through the i18n dictionary (config.language),
 * so switching the language re-renders the whole page immediately.
 */
import {
  formatMiB,
  parseExtensions,
  parseThresholdBytes,
} from "./lib/config.js";
import type { CompressTiming, Language } from "./lib/config.js";
import { defaultConfig, loadConfig, saveConfig } from "./lib/storage.js";
import { t } from "./lib/i18n.js";
import type { MessageKey } from "./lib/i18n.js";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
};

/** Fill [data-i18n] text nodes and [data-i18n-placeholder] attributes. */
function applyI18n(lang: Language) {
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n as MessageKey | undefined;
    if (key) el.textContent = t(lang, key);
  });
  document
    .querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]")
    .forEach((el) => {
      const key = el.dataset.i18nPlaceholder as MessageKey | undefined;
      if (key) el.placeholder = t(lang, key);
    });
  document.title = t(lang, "optionsTitle");
}

function renderPreview(lang: Language) {
  const extRaw = $<HTMLInputElement>("extensions").value;
  const thresholdRaw = $<HTMLInputElement>("threshold").value;
  const normalized = parseExtensions(extRaw);
  const bytes = parseThresholdBytes(thresholdRaw || "0");
  const preview = $<HTMLDivElement>("preview");
  preview.textContent = normalized.length
    ? t(lang, "previewConfigured", {
        exts: normalized.join(", "),
        threshold: formatMiB(bytes),
        bytes: bytes.toLocaleString(),
      })
    : t(lang, "previewNone");
}

async function init() {
  const cfg = await loadConfig().catch(() => defaultConfig());
  applyI18n(cfg.language);

  $<HTMLInputElement>("extensions").value = cfg.extensions.join(", ");
  $<HTMLInputElement>("threshold").value = String(
    Math.round((cfg.thresholdBytes / 1_048_576) * 10) / 10,
  );
  const modeRadio = document.querySelector<HTMLInputElement>(
    `input[name="mode"][value="${cfg.mode}"]`,
  );
  if (modeRadio) modeRadio.checked = true;
  const timingRadio = document.querySelector<HTMLInputElement>(
    `input[name="timing"][value="${cfg.timing}"]`,
  );
  if (timingRadio) timingRadio.checked = true;
  const langSelect = $<HTMLSelectElement>("language");
  langSelect.value = cfg.language;

  renderPreview(cfg.language);
  ["extensions", "threshold"].forEach((id) =>
    $(id).addEventListener("input", () =>
      renderPreview(langSelect.value as Language),
    ),
  );
  langSelect.addEventListener("change", () => {
    const lang = langSelect.value as Language;
    applyI18n(lang);
    renderPreview(lang);
  });

  $<HTMLButtonElement>("save").addEventListener("click", async () => {
    const status = $<HTMLDivElement>("status");
    const lang = langSelect.value as Language;
    const extensions = parseExtensions(
      $<HTMLInputElement>("extensions").value,
    );
    const thresholdBytes = parseThresholdBytes(
      $<HTMLInputElement>("threshold").value,
    );
    if (extensions.length === 0) {
      status.className = "err";
      status.textContent = t(lang, "errEmptyExtensions");
      return;
    }
    if (thresholdBytes <= 0) {
      status.className = "err";
      status.textContent = t(lang, "errThreshold");
      return;
    }
    const mode = (
      document.querySelector<HTMLInputElement>(
        'input[name="mode"]:checked',
      )?.value ?? "auto"
    ) as "auto" | "ask";
    const timing = (
      document.querySelector<HTMLInputElement>(
        'input[name="timing"]:checked',
      )?.value ?? "on-send"
    ) as CompressTiming;
    await saveConfig({ extensions, thresholdBytes, mode, timing, language: lang });
    status.className = "ok";
    status.textContent = t(lang, "saved", {
      exts: extensions.join(", "),
      threshold: formatMiB(thresholdBytes),
      mode: t(lang, mode === "auto" ? "savedModeAuto" : "savedModeAsk"),
      timing: t(
        lang,
        timing === "on-send" ? "savedTimingOnSend" : "savedTimingOnAdd",
      ),
    });
  });
}

void init();
