/**
 * MailZip background script.
 *
 * Hooks compose.onBeforeSend (Thunderbird 74+): when the user clicks send,
 * inspect all attachments, zip the ones matching the configured extension +
 * size rules, replace originals with ZIPs, and let Thunderbird continue.
 *
 * Flow:
 *   onBeforeSend
 *     → listAttachments
 *     → filter by shouldCompress (extension match AND size > threshold)
 *     → none match: return immediately, do NOT interfere with normal send
 *     → auto mode: zip & replace, then continue send
 *     → ask mode: show confirmation window (cancel / send raw / zip & send)
 */
import { shouldCompress, zipFileName } from "./lib/config.js";
import { loadConfig } from "./lib/storage.js";
import { zipFile } from "./lib/zipper.js";

type AskChoice = "cancel" | "send-raw" | "send-zipped";

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
      (choice === "cancel" || choice === "send-raw" || choice === "send-zipped")
    ) {
      askResolve(choice);
      askResolve = null;
    }
  }
  return false;
});

function showAskWindow(
  candidates: { name: string; size: number }[],
): Promise<AskChoice> {
  return new Promise((resolve) => {
    askResolve = resolve;
    const params = new URLSearchParams({
      files: JSON.stringify(candidates),
    });
    void messenger.windows.create({
      url: `dist/ask.html?${params.toString()}`,
      type: "popup",
      width: 480,
      height: 380,
    });
  });
}

async function zipAndReplace(
  tabId: number,
  candidates: { id: number; name: string }[],
): Promise<void> {
  for (const att of candidates) {
    const file = await messenger.compose.getAttachmentFile(att.id);
    const zipped = await zipFile(file);
    // Remove original, then add ZIP. Both operations apply to the compose
    // window immediately; Thunderbird sends whatever is in the compose
    // window after the listener resolves.
    await messenger.compose.removeAttachment(tabId, att.id);
    await messenger.compose.addAttachment(tabId, {
      file: new File([zipped], zipFileName(att.name || "attachment")),
    });
  }
}

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
