/**
 * Minimal two-language UI dictionary (English default, Chinese optional).
 *
 * Pure logic, no Thunderbird API dependencies — unit-testable in isolation.
 * The options page and the ask window render all user-facing strings through
 * t(), so a language switch (config.language) re-renders the whole UI.
 */
import type { Language } from "./config.js";

export const LANGUAGES: readonly Language[] = ["en", "zh"];

const messages = {
  en: {
    optionsTitle: "MailZip Settings",
    optionsDescription:
      "When sending mail, automatically compress matching attachments (by extension and size threshold) into ZIP.",
    extensionsLabel: "Extensions to compress",
    extensionsPlaceholder: "e.g. stp, step, dwg, dxf",
    extensionsHint:
      "Separate multiple extensions with commas or spaces. Case, leading dots (.stp) and extra spaces are handled automatically. Stored as lowercase, without dots.",
    thresholdLabel: "Size threshold (MB)",
    thresholdHint:
      "1 MB = 1,048,576 bytes (1 MiB). Attachments strictly larger than this are compressed (>; not equal).",
    modeLabel: "Action",
    modeAuto: "Auto-compress",
    modeAutoHint: "Compress matching attachments immediately and continue.",
    modeAsk: "Ask before compressing",
    modeAskHint: "Show a confirmation window before compressing.",
    timingLabel: "When to compress",
    timingOnSend: "Before sending",
    timingOnSendHint: "Compress when you click Send.",
    timingOnAdd: "After adding attachments",
    timingOnAddHint:
      "Compress as soon as attachments are added (drag & drop or the attach button).",
    languageLabel: "Language",
    save: "Save",
    previewNone: "No extensions configured: the extension will not affect sending.",
    previewConfigured:
      "Normalized: {exts}; threshold {threshold} MB ({bytes} bytes)",
    errEmptyExtensions: "Extensions cannot be empty.",
    errThreshold: "Size threshold must be greater than 0.",
    saved: "Saved: {exts}, > {threshold} MB, {mode}, {timing}",
    savedModeAuto: "auto-compress",
    savedModeAsk: "ask",
    savedTimingOnSend: "before sending",
    savedTimingOnAdd: "after adding attachments",
    askTitle: "MailZip: the following attachment(s) match the compression rules",
    askHint: "After compression the original attachment is replaced with <filename>.zip.",
    askNoFiles: "(could not read the attachment list)",
    btnCancelSend: "Cancel sending",
    btnRawSend: "Send without compressing",
    btnZipSend: "Compress and send",
    btnRemove: "Remove attachment",
    btnKeepRaw: "Keep as is",
    btnZipAdd: "Compress and replace",
  },
  zh: {
    optionsTitle: "MailZip 设置",
    optionsDescription:
      "发送邮件时，自动将符合条件（后缀匹配且超过大小阈值）的附件压缩为 ZIP 后再发送。",
    extensionsLabel: "压缩文件后缀",
    extensionsPlaceholder: "例如：stp, step, dwg, dxf",
    extensionsHint:
      "多个后缀用逗号或空格分隔。自动处理大小写、前导点号（.stp）和多余空格。内部统一为小写、不带点。",
    thresholdLabel: "文件大小阈值（MB）",
    thresholdHint:
      "1 MB = 1,048,576 字节（1 MiB）。附件大小严格大于该值才压缩（>，不含等于）。",
    modeLabel: "处理方式",
    modeAuto: "自动压缩",
    modeAutoHint: "发现符合条件附件后直接压缩并继续。",
    modeAsk: "询问后压缩",
    modeAskHint: "压缩前弹出确认窗口。",
    timingLabel: "压缩时机",
    timingOnSend: "发送前",
    timingOnSendHint: "点击发送时压缩。",
    timingOnAdd: "添加附件后",
    timingOnAddHint: "附件一添加（拖拽或添加按钮）就立即压缩。",
    languageLabel: "语言",
    save: "保存",
    previewNone: "未配置后缀：扩展将完全不影响发送。",
    previewConfigured: "规范化后：{exts}；阈值 {threshold} MB（{bytes} 字节）",
    errEmptyExtensions: "后缀不能为空。",
    errThreshold: "大小阈值必须大于 0。",
    saved: "已保存：{exts}，> {threshold} MB，{mode}，{timing}",
    savedModeAuto: "自动压缩",
    savedModeAsk: "询问压缩",
    savedTimingOnSend: "发送前",
    savedTimingOnAdd: "添加附件后",
    askTitle: "MailZip：以下附件符合压缩条件",
    askHint: "压缩后原附件将被替换为 <文件名>.zip。",
    askNoFiles: "（无法读取附件列表）",
    btnCancelSend: "取消发送",
    btnRawSend: "不压缩，继续发送",
    btnZipSend: "压缩后发送",
    btnRemove: "移除附件",
    btnKeepRaw: "保留原样",
    btnZipAdd: "压缩替换",
  },
} as const;

export type MessageKey = keyof typeof messages.en;

/**
 * Translate a key into the requested language.
 * Falls back to English for missing keys; supports {param} substitution.
 */
export function t(
  lang: Language,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const dict = messages[lang] as unknown as Record<MessageKey, string>;
  let s: string = dict[key] ?? messages.en[key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

export { messages };
