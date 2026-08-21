/**
 * MailZip background script.
 *
 * Hooks compose.onBeforeSend (Thunderbird 74+) and compose.onAttachmentAdded
 * (Thunderbird 78+). Depending on config.timing:
 *
 *   on-send: when the user clicks send, inspect all attachments, zip the ones
 *            matching the configured extension + size rules, replace originals
 *            with ZIPs, and let Thunderbird continue.
 *   on-add:  as soon as an attachment is added (drag & drop or the attach
 *            button), zip it right away. onBeforeSend then skips compression.
 *
 * Flow (both timings):
 *   event → filter by shouldCompress (extension match AND size > threshold)
 *     → none match: do nothing
 *     → auto mode: zip & replace
 *     → ask mode: show confirmation window
 *         on-send: cancel sending / send raw / zip & send
 *         on-add:  remove attachment / keep as is / zip & replace
 */
import { shouldCompress, zipFileName } from "./lib/config.js";
import type { MailZipConfig } from "./lib/config.js";
import { loadConfig } from "./lib/storage.js";
import { zipFile } from "./lib/zipper.js";

type AskChoice =
  | "cancel"
  | "send-raw"
  | "send-zipped"
  | "remove"
  | "keep-raw"
  | "zip";

const ASK_CHOICES: readonly AskChoice[] = [
  "cancel",
  "send-raw",
  "send-zipped",
  "remove",
  "keep-raw",
  "zip",
];

let askResolve: ((choice: AskChoice) => void) | null = null;

messenger.runtime.onMessage.addListener((message: unknown) => {
  if (
    message &&
    typeof message === "object" &&
    (message as { type?: string }).type === "mailzip-ask-choice"
  ) {
    const choice = (message as { choice?: string }).choice;
    if (
      askResolve &&
      choice &&
      ASK_CHOICES.includes(choice as AskChoice)
    ) {
      askResolve(choice as AskChoice);
      askResolve = null;
    }
  }
  return false;
});

/**
 * Serialize async work (on-add events, ask windows). onAttachmentAdded fires
 * once per attached file; dragging several files at once would otherwise
 * create overlapping remove/add operations and overlapping ask windows.
 */
let queue: Promise<void> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const p = queue.then(fn);
  queue = p.then(
    () => undefined,
    () => undefined,
  );
  return p;
}

function showAskWindow(
  candidates: { name: string; size: number }[],
  timing: MailZipConfig["timing"],
  language: MailZipConfig["language"],
): Promise<AskChoice> {
  return new Promise((resolve) => {
    askResolve = resolve;
    const params = new URLSearchParams({
      files: JSON.stringify(candidates),
      timing,
      lang: language,
    });
    void messenger.windows.create({
      url: `ask.html?${params.toString()}`,
      type: "popup",
      width: 480,
      height: 380,
    });
  });
}

/**
 * Recursion guard: addAttachment() fires onAttachmentAdded for the ZIP we just
 * created. Remember each zip we add (tabId + name + size) and skip that
 * attachment when the event arrives. consumeOurZip() deletes the entry, so the
 * Set does not grow unbounded.
 */
const ourZips = new Set<string>();
function markOurZip(tabId: number, name: string, size: number) {
  ourZips.add(`${tabId}\u0000${name}\u0000${size}`);
}
function consumeOurZip(
  tabId: number | undefined,
  name: string | undefined,
  size: number | undefined,
): boolean {
  if (tabId === undefined) return false;
  return ourZips.delete(`${tabId}\u0000${name ?? ""}\u0000${size ?? 0}`);
}

async function zipAndReplace(
  tabId: number,
  candidates: { id: number; name: string }[],
): Promise<void> {
  for (const att of candidates) {
    const file = await messenger.compose.getAttachmentFile(att.id);
    const zipped = await zipFile(file);
    const zipName = zipFileName(att.name || "attachment");
    // Mark BEFORE addAttachment: the event it fires must be skipped.
    markOurZip(tabId, zipName, zipped.size);
    await messenger.compose.removeAttachment(tabId, att.id);
    await messenger.compose.addAttachment(tabId, {
      file: new File([zipped], zipName),
    });
  }
}

/** on-add timing: process a single freshly added attachment. */
async function handleAttachmentAdded(
  tabId: number,
  attachment: { id: number; name?: string; size?: number },
  cfg: MailZipConfig,
): Promise<void> {
  if (consumeOurZip(tabId, attachment.name, attachment.size)) return;
  const name = attachment.name ?? "";
  if (!shouldCompress(name, attachment.size ?? 0, cfg)) return;

  if (cfg.mode === "ask") {
    const choice = await showAskWindow(
      [{ name, size: attachment.size ?? 0 }],
      "on-add",
      cfg.language,
    );
    if (choice === "remove") {
      await messenger.compose.removeAttachment(tabId, attachment.id);
      return;
    }
    if (choice === "keep-raw") return;
    // "zip": fall through to compression
  }
  await zipAndReplace(tabId, [{ id: attachment.id, name }]);
}

messenger.compose.onAttachmentAdded.addListener((tab, attachment) => {
  void enqueue(async () => {
    const cfg = await loadConfig();
    if (cfg.timing !== "on-add") return;
    if (cfg.extensions.length === 0) return;
    if (tab.id === undefined) return;
    try {
      await handleAttachmentAdded(tab.id, attachment, cfg);
    } catch (err) {
      // Compression failed BEFORE any removal (zip happens first), so the
      // compose window is unchanged. Log and keep the original attachment.
      console.error("[MailZip] on-add compression failed:", err);
    }
  });
});

/**
 * Thunderbird officially supports async onBeforeSend listeners that return a
 * Promise of { cancel?, details? } ("For asynchronous listeners some
 * restrictions apply."). The @types/thunderbird-webext-browser package has
 * not caught up with the async signature, so the listener is typed via a
 * cast. See README "Known limitations" for the async-listener discussion.
 */
type BeforeSendListener = Parameters<
  typeof messenger.compose.onBeforeSend.addListener
>[0];
type BeforeSendArgs = Parameters<BeforeSendListener>;

const beforeSendListener = (async (
  tab: BeforeSendArgs[0],
  _details: BeforeSendArgs[1],
) => {
  const cfg = await loadConfig();

  // No extensions configured: never interfere with sending.
  if (cfg.extensions.length === 0) return { cancel: false };

  // on-add timing already compressed qualifying attachments when they were
  // added; skip here to avoid double-processing.
  if (cfg.timing === "on-add") return { cancel: false };

  if (tab.id === undefined) return { cancel: false };

  const attachments = await messenger.compose.listAttachments(tab.id);
  const candidates = attachments.filter(
    (a) => shouldCompress(a.name ?? "", a.size ?? 0, cfg),
  );

  // Nothing qualifies: completely bypass Thunderbird's normal send path.
  if (candidates.length === 0) return { cancel: false };

  if (cfg.mode === "ask") {
    const choice = await showAskWindow(
      candidates.map((a) => ({
        name: a.name ?? "attachment",
        size: a.size ?? 0,
      })),
      "on-send",
      cfg.language,
    );
    if (choice === "cancel") return { cancel: true };
    if (choice === "send-raw") return { cancel: false };
  }

  try {
    await zipAndReplace(
      tab.id,
      candidates.map((a) => ({ id: a.id, name: a.name ?? "attachment" })),
    );
  } catch (err) {
    // Compression failed BEFORE any removal (zip happens first), so the
    // message is unchanged. Do not silently corrupt the outgoing mail:
    // log the error and let Thunderbird send the original attachments.
    console.error("[MailZip] compression failed, sending originals:", err);
    return { cancel: false };
  }

  return { cancel: false };
}) as unknown as BeforeSendListener;

messenger.compose.onBeforeSend.addListener(beforeSendListener);
