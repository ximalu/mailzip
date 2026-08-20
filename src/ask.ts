/**
 * MailZip ask-mode confirmation window.
 * Receives candidate list via URL query, sends the user's choice back to
 * the background script, then closes itself.
 */
import { formatMiB } from "./lib/config.js";

type AskChoice = "cancel" | "send-raw" | "send-zipped";

interface Candidate {
  name: string;
  size: number;
}

function readCandidates(): Candidate[] {
  const raw = new URLSearchParams(location.search).get("files");
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

function init() {
  const candidates = readCandidates();
  const list = document.getElementById("files");
  if (!list) return;
  for (const c of candidates) {
    const li = document.createElement("li");
    li.textContent = `${c.name}（${formatMiB(c.size)} MB）`;
    list.appendChild(li);
  }
  if (candidates.length === 0) {
    const li = document.createElement("li");
    li.textContent = "（无法读取附件列表）";
    list.appendChild(li);
  }
}

function choose(choice: AskChoice) {
  void messenger.runtime.sendMessage({
    type: "mailzip-ask-choice",
    choice,
  });
  window.close();
}

init();
document.getElementById("cancel")?.addEventListener("click", () => choose("cancel"));
document.getElementById("raw")?.addEventListener("click", () => choose("send-raw"));
document.getElementById("zip")?.addEventListener("click", () => choose("send-zipped"));
