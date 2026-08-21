/**
 * Settings persistence on top of messenger.storage.local.
 */
import {
  BYTES_PER_MIB,
  DEFAULT_LANGUAGE,
  DEFAULT_MODE,
  DEFAULT_THRESHOLD_MIB,
  DEFAULT_TIMING,
  MailZipConfig,
} from "./config.js";

const STORAGE_KEY = "mailzip.config";

export function defaultConfig(): MailZipConfig {
  return {
    extensions: [],
    thresholdBytes: DEFAULT_THRESHOLD_MIB * BYTES_PER_MIB,
    mode: DEFAULT_MODE,
    timing: DEFAULT_TIMING,
    language: DEFAULT_LANGUAGE,
  };
}

export async function loadConfig(): Promise<MailZipConfig> {
  const stored = await messenger.storage.local.get(STORAGE_KEY);
  const raw = (stored as Record<string, unknown>)[STORAGE_KEY] as
    | Partial<MailZipConfig>
    | undefined;
  if (!raw) return defaultConfig();
  return {
    extensions: Array.isArray(raw.extensions)
      ? raw.extensions.filter((e): e is string => typeof e === "string")
      : [],
    thresholdBytes:
      typeof raw.thresholdBytes === "number" && raw.thresholdBytes > 0
        ? raw.thresholdBytes
        : defaultConfig().thresholdBytes,
    mode: raw.mode === "ask" ? "ask" : "auto",
    timing: raw.timing === "on-add" ? "on-add" : "on-send",
    language: raw.language === "zh" ? "zh" : "en",
  };
}

export async function saveConfig(cfg: MailZipConfig): Promise<void> {
  await messenger.storage.local.set({ [STORAGE_KEY]: cfg });
}
