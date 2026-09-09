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

/**
 * Pending ask windows, keyed by their window id.
 *
 * Multiple compose windows can send at the same time, each opening its own
 * ask popup. A single module-level resolve slot would let the second window
 * overwrite the first, so each popup window id maps to its own resolve
 * callback (and the timing it was opened for, which decides the default
 * choice when the popup is dismissed without a button press).
 */
type AskEntry = {
  resolve: (choice: AskChoice) => void;
  timing: MailZipConfig["timing"];
};
const askWindows = new Map<number, AskEntry>();

/**
 * Default choice when the ask popup is closed without pressing a button:
 *  on-send → cancel sending (never send un-zipped by accident),
 *  on-add  → keep the original attachment untouched. */
function defaultAskChoice(timing: MailZipConfig["timing"]): AskChoice {
  return timing === "on-add" ? "keep-raw" : "cancel";
}

messenger.runtime.onMessage.addListener((message: unknown) => {
  if (
    message &&
    typeof message === "object" &&
    (message as { type?: string }).type === "mailzip-ask-choice"
  ) {
    const { choice, windowId } = message as {
      choice?: string;
      windowId?: number;
    };
    let entry: AskEntry | undefined;
    let entryId: number | undefined;
    if (windowId != null) {
      entry = askWindows.get(windowId);
      entryId = windowId;
    } else if (askWindows.size === 1) {
      // ask.ts normally reports its window id; tolerate messages without one
      // when exactly one ask window is pending.
      entryId = askWindows.keys().next().value;
      entry = entryId != null ? askWindows.get(entryId) : undefined;
    }
    if (entry && choice && ASK_CHOICES.includes(choice as AskChoice)) {
      if (entryId != null) askWindows.delete(entryId);
      entry.resolve(choice as AskChoice);
    }
  }
  return false;
});

/** Fallback: user closes the ask popup via the window X (no button pressed).
 *  Resolve with the safe default so onBeforeSend / onAttachmentAdded never
 *  hang forever. */
messenger.windows.onRemoved.addListener((windowId: number) => {
  const entry = askWindows.get(windowId);
  if (entry) {
    askWindows.delete(windowId);
    entry.resolve(defaultAskChoice(entry.timing));
  }
});

/** Keep the ask popup above Thunderbird until the user has decided.
 *
 * Right after creation Thunderbird can steal focus back to the compose window
 * (its own window-raise logic may run after ours), which leaves the popup
 * buried. While an ask popup is pending the onBeforeSend/onAttachmentAdded
 * listener is blocked anyway, so re-raising the popup never interrupts real
 * work. windows.onFocusChanged only reports Thunderbird's own windows (focus
 * moving to another application arrives as WINDOW_ID_NONE), so this never
 * yanks focus away from other apps. With several popups pending we stay out
 * of the way to avoid focus fights between them. */
messenger.windows.onFocusChanged.addListener((focusedWindowId: number) => {
  if (focusedWindowId === messenger.windows.WINDOW_ID_NONE) return;
  if (askWindows.size !== 1) return;
  const pendingId = askWindows.keys().next().value;
  if (pendingId !== undefined && pendingId !== focusedWindowId) {
    void raiseAskWindow(pendingId);
  }
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

const ASK_WINDOW_WIDTH = 480;
const ASK_WINDOW_HEIGHT = 380;

/** Bring an ask popup to the front. windows.create ignores `focused` in
 *  Thunderbird (schema marks it unsupported), so this has to be a
 *  windows.update after the window exists. `attention` additionally flashes
 *  the taskbar entry; only useful right after creation, repeat focus steals
 *  must stay quiet. */
async function raiseAskWindow(
  windowId: number,
  attention = false,
): Promise<void> {
  try {
    await messenger.windows.update(
      windowId,
      attention
        ? { focused: true, drawAttention: true }
        : { focused: true },
    );
  } catch (err) {
    console.warn("[MailZip] could not focus ask window:", err);
  }
}

function showAskWindow(
  candidates: { name: string; size: number }[],
  timing: MailZipConfig["timing"],
  language: MailZipConfig["language"],
): Promise<AskChoice> {
  return new Promise((resolve) => {
    void (async () => {
      const params = new URLSearchParams({
        files: JSON.stringify(candidates),
        timing,
        lang: language,
      });
      const url = `ask.html?${params.toString()}`;
      let win;
      try {
        // Thunderbird's windows.create ignores the focused flag. Center the
        // popup on the currently focused (compose) window so it reads as part
        // of the compose flow; raiseAskWindow() brings it to the front once it
        // exists (the onFocusChanged guard below keeps it there).
        const focused = await messenger.windows.getLastFocused();
        const createData: Parameters<
          typeof messenger.windows.create
        >[0] = {
          url,
          type: "popup",
          width: ASK_WINDOW_WIDTH,
          height: ASK_WINDOW_HEIGHT,
        };
        if (
          focused &&
          typeof focused.left === "number" &&
          typeof focused.top === "number" &&
          typeof focused.width === "number" &&
          typeof focused.height === "number"
        ) {
          createData.left = Math.max(
            0,
            Math.round(focused.left + (focused.width - ASK_WINDOW_WIDTH) / 2),
          );
          createData.top = Math.max(
            0,
            Math.round(focused.top + (focused.height - ASK_WINDOW_HEIGHT) / 2),
          );
        }
        win = await messenger.windows.create(createData);
      } catch (err) {
        // Window could not be created at all (e.g. popups blocked): resolve
        // with the safe default so the send is never silently unzipped and
        // onBeforeSend never hangs.
        console.error("[MailZip] ask window creation failed:", err);
        resolve(defaultAskChoice(timing));
        return;
      }

      const windowId = win?.id;
      if (windowId === undefined) {
        resolve(defaultAskChoice(timing));
        return;
      }
      askWindows.set(windowId, { resolve, timing });

      // windows.create has no focused support in Thunderbird (schema marks it
      // unsupported); bring the popup to the front now that it exists.
      await raiseAskWindow(windowId, true);
    })();
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
