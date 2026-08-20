/**
 * MailZip options page: load/save the three settings.
 */
import {
  formatMiB,
  parseExtensions,
  parseThresholdBytes,
} from "./lib/config.js";
import { defaultConfig, loadConfig, saveConfig } from "./lib/storage.js";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
};

function renderPreview() {
  const extRaw = $<HTMLInputElement>("extensions").value;
  const thresholdRaw = $<HTMLInputElement>("threshold").value;
  const normalized = parseExtensions(extRaw);
  const bytes = parseThresholdBytes(thresholdRaw || "0");
  const preview = $<HTMLDivElement>("preview");
  preview.textContent = normalized.length
    ? `规范化后：${normalized.join(", ")}；阈值 ${formatMiB(bytes)} MB（${bytes.toLocaleString()} 字节）`
    : "未配置后缀：扩展将完全不影响发送。";
}

async function init() {
  const cfg = await loadConfig().catch(() => defaultConfig());
  $<HTMLInputElement>("extensions").value = cfg.extensions.join(", ");
  $<HTMLInputElement>("threshold").value = String(
    Math.round((cfg.thresholdBytes / 1_048_576) * 10) / 10,
  );
  const radio = document.querySelector<HTMLInputElement>(
    `input[name="mode"][value="${cfg.mode}"]`,
  );
  if (radio) radio.checked = true;
  renderPreview();
  ["extensions", "threshold"].forEach((id) =>
    $(id).addEventListener("input", renderPreview),
  );
  $<HTMLButtonElement>("save").addEventListener("click", async () => {
    const status = $<HTMLDivElement>("status");
    const extensions = parseExtensions(
      $<HTMLInputElement>("extensions").value,
    );
    const thresholdBytes = parseThresholdBytes(
      $<HTMLInputElement>("threshold").value,
    );
    if (extensions.length === 0) {
      status.className = "err";
      status.textContent = "后缀不能为空。";
      return;
    }
    if (thresholdBytes <= 0) {
      status.className = "err";
      status.textContent = "大小阈值必须大于 0。";
      return;
    }
    const mode = (
      document.querySelector<HTMLInputElement>(
        'input[name="mode"]:checked',
      )?.value ?? "auto"
    ) as "auto" | "ask";
    await saveConfig({ extensions, thresholdBytes, mode });
    status.className = "ok";
    status.textContent = `已保存：${extensions.join(", ")}，> ${formatMiB(thresholdBytes)} MB，${
      mode === "auto" ? "自动压缩" : "询问后压缩"
    }`;
  });
}

void init();
