/**
 * MailZip ask-mode confirmation window.
 * Receives candidate list via URL query, sends the user's choice back to
 * the background script, then closes itself.
 *
 * The wording of the three actions depends on the compression timing:
 *  - on-send: cancel sending / send without compressing / compress and send
 *  - on-add:  remove attachment / keep as is / compress and replace
 */
import { formatMiB } from "./lib/config.js";
import type { Language } from "./lib/config.js";
import { t } from "./lib/i18n.js";
import type { MessageKey } from "./lib/i18n.js";

type AskChoice = "cancel" | "send-raw" | "send-zipped" | "remove" | "keep-raw" | "zip";
type AskTiming = "on-send" | "on-add";

interface Candidate {
  name: string;
  size: number;
}

function readParam(name: string): string | null {
  return new URLSearchParams(location.search).get(name);
}

function readTiming(): AskTiming {
  return readParam("timing") === "on-add" ? "on-add" : "on-send";
}

function readLanguage(): Language {
  return readParam("lang") === "zh" ? "zh" : "en";
}

function readCandidates(): Candidate[] {
  const raw = readParam("files");
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter(
          (x): x is Candidate =>
            typeof x === "object" &&
            x !== null &&
            typeof (x as Candidate).name === "string",
        )
        .map((x) => ({ name: x.name, size: typeof x.size === "number" ? x.size : 0 }));
    }
  } catch {
    // ignore malformed query
  }
  return [];
}

function applyI18n(lang: Language, timing: AskTiming) {
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n as MessageKey | undefined;
    if (key) el.textContent = t(lang, key);
  });
  document.title = t(lang, "askTitle");
  const cancelBtn = document.getElementById("cancel");
  const rawBtn = document.getElementById("raw");
  const zipBtn = document.getElementById("zip");
  if (cancelBtn) {
    cancelBtn.textContent = t(lang, timing === "on-add" ? "btnRemove" : "btnCancelSend");
  }
  if (rawBtn) {
    rawBtn.textContent = t(lang, timing === "on-add" ? "btnKeepRaw" : "btnRawSend");
  }
  if (zipBtn) {
    zipBtn.textContent = t(lang, timing === "on-add" ? "btnZipAdd" : "btnZipSend");
  }
}

function init() {
  const timing = readTiming();
  const lang = readLanguage();
  applyI18n(lang, timing);

  const candidates = readCandidates();
  const list = document.getElementById("files");
  if (!list) return;
  for (const c of candidates) {
    const li = document.createElement("li");
    li.textContent = `${c.name} (${formatMiB(c.size)} MB)`;
    list.appendChild(li);
  }
  if (candidates.length === 0) {
    const li = document.createElement("li");
    li.textContent = t(lang, "askNoFiles");
    list.appendChild(li);
  }

  const choiceMap: Record<string, AskChoice> =
    timing === "on-add"
      ? { cancel: "remove", raw: "keep-raw", zip: "zip" }
      : { cancel: "cancel", raw: "send-raw", zip: "send-zipped" };
  document.getElementById("cancel")?.addEventListener("click", () => choose(choiceMap.cancel));
  document.getElementById("raw")?.addEventListener("click", () => choose(choiceMap.raw));
  document.getElementById("zip")?.addEventListener("click", () => choose(choiceMap.zip));
}

function choose(choice: AskChoice) {
  void messenger.runtime.sendMessage({
    type: "mailzip-ask-choice",
    choice,
  });
  window.close();
}

init();
