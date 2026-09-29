# ATN 上架材料（addons.thunderbird.net）

> 用途：MailZip 公开上架（listed 路线）的提交资料。2026-08-21 建立；2026-09-29 更新至 0.2.7（更新提交材料）。

## 提交 zip

- 位置：`dist/` 内容打包，manifest.json 在 zip 根
- 打包命令：`cd dist && zip -r -X ../mailzip-<version>-amo.zip .`
- 源码包：`zip -r -X ../mailzip-<version>-src.zip . -x 'node_modules/*' '.git/*' 'dist/*' '*.zip'`

### 0.2.7 更新提交文件（2026-09-29）

- `mailzip-0.2.7-amo.zip` — 65,752 字节，md5 `81f6e39e65c22dd641b451429e03eff6`（上传到 ATN 的扩展包）
- `mailzip-0.2.7-src.zip` — 54,795 字节，md5 `6cc878bf783347d295f665c7e9c5b7a8`（源码包，表单问 Source Code 时选 Yes 上传）
- 线上（listed）当前版本：0.2.5 → 本次提交 0.2.7（0.2.6 未单独上架，修复内容并入 0.2.7）

## 商店信息（提交时复制）

- **Name**: MailZip
- **Add-on URL (slug)**: mailzip（若冲突系统会提示改名）
- **Summary**: Automatically compress email attachments into ZIP files by extension and size rules — before sending or right after you attach them.
- **Description**:

```
MailZip automatically compresses email attachments into ZIP files based on rules you define — no manual zipping before sending.

Features:
- Rule-based matching: compress attachments whose file extension (e.g. stp, step, dwg, dxf) AND size threshold match your settings.
- Two compression timings:
  * Before sending: compress matching attachments when you click Send.
  * After adding: compress as soon as you drag & drop or attach files (multiple files are handled one by one).
- Two action modes: auto-compress, or ask first with a confirmation window (cancel / keep original / compress).
- Language: English (default) or 中文.
- No data collection: all settings are stored locally (storage.local). No network requests are made.
- Safe by design: if compression fails, your original attachments are sent unchanged.

Works with Thunderbird 98 and later.
```

- **This add-on is experimental**: 不勾选
- **数据收集声明**（表单 Data Collection）: 不收集任何数据（No data collection / no analytics / no telemetry）
- **隐私政策**: 不收集数据 → 不需要额外隐私政策链接
- **截图**: 可选，建议上传设置页截图（后续补）

## 0.2.7 版本更新说明（Release Notes，英中双语）

提交新版本时，表单的 "Release Notes" 字段可直接粘贴（中英两段都给；也可只贴英文段）。

**English**

```
Fixed the confirmation window's placement and focus, and made accidental sending much harder.

- The confirmation window now opens centered on the compose window. It could previously appear behind Thunderbird, or cover the Send button — so a second click on Send could land on the window instead.
- The window stays in front while you decide, and does not steal focus back when you switch to another application.
- Closing the window with X, or failing to open it, now fails safe: for "before sending" the message is not sent; for "after adding" the original attachment is kept. No more hung sends.
- Multiple compose windows no longer interfere with each other.

Compression behaviour and settings are unchanged; your existing settings are kept.
Note this release is the first update since 0.2.5 — the 0.2.6 fixes are included.
```

**中文**

```
修复了确认窗口的位置与焦点问题，大幅降低误发邮件的风险。

- 确认窗口现在居中显示在写邮件窗口上。此前它可能落在 Thunderbird 后面，或盖住“发送”按钮——以至于再点一次“发送”实际点到了窗口上。
- 确认期间窗口保持最前；切到其他应用时不会抢回焦点。
- 用 X 关闭窗口、或窗口打开失败时按安全默认处理：发送前询问＝取消发送，添加附件后询问＝保留原附件。不再出现发送流程卡死。
- 多个写邮件窗口并发时互不干扰。

压缩行为与设置项没有改动，已有设置保持不变。
本次是 0.2.5 之后的首次更新，包含 0.2.6 的修复。
```

## 0.2.7 提交前验证（2026-09-29 实跑）

- `npm run typecheck` ✓
- `npm test` ✓ 34 passed（3 files）
- `npm run test:sandbox` ✓（Thunderbird-like 无 Node 全局环境，zipFile 可运行）
- `npm run build` ✓；`grep -c 'new Function' dist/background.js` = 0
- `npx web-ext lint --source-dir dist`：errors 0 / notices 0 / warnings 2（见下）

## 审核测试说明（审核员人工测试时用）

审核员会安装扩展并测试功能，请提供以下说明（英文）：

```
How to test MailZip:

1. Install the add-on and open its preferences page (Add-ons Manager → MailZip → Preferences).
2. Configure: extensions = "stp", threshold = 1 MB, timing = "Before sending", mode = "Auto-compress".
3. Create any file named test.stp larger than 1 MB (e.g. a text file renamed), plus a smaller file small.stp.
4. Write a new email and attach both files, then click Send.
   Expected: test.stp is replaced by test.stp.zip; small.stp stays unchanged.
5. Optional: switch timing to "After adding" — attaching test.stp should immediately turn it into test.stp.zip without clicking Send.
6. The ZIP opens correctly; the original file is inside.

Permissions: "compose" is required to read and replace attachments; "storage" to save settings.
No other permissions, no network access, no data collection.
```

## 已知 lint warnings（提交时如有提示）

1. `MANIFEST_PERMISSIONS: Invalid permissions "compose"` — web-ext (Firefox linter) 不认识 Thunderbird 特有权限，误报。compose 是官方 Thunderbird 权限（webextension-api.thunderbird.net），ATN validator 认识。**保留。**
2. `MISSING_DATA_COLLECTION_PERMISSIONS` — 新增提示（0.2.7 提交时出现）：Firefox 侧要求 `browser_specific_settings.gecko.data_collection_permissions`（如 `{"required":["none"]}`）。
   **本次不添加**：addons-linter 只在声明的 Gecko 最低版本支持该 key 时才接受它（Firefox 140 / Thunderbird 140+），而 MailZip 的 `strict_min_version` 是 `98.0`——加上会让最低版本被迫抬到 140，损失老版本用户，并且新 key 在旧 TB 上是否被安全忽略尚未实测。
   处理方式：0.2.7 照常提交（errors 0，ATN 校验可过）；等确认 Thunderbird 对 `strict_min_version < 140` + 该 key 的行为后，再决定是抬最低版本还是保持现状。

DANGEROUS_EVAL 已于 0.2.3 消除（setimmediate 包 alias 为无 eval shim），不应再出现。

## 提交流程

1. 注册/登录 Mozilla 账号
2. 打开 https://addons.thunderbird.net/en-US/developers/ 接受开发者协议
3. 已有扩展更新版本：开发者 hub → MailZip → Upload New Version（不是 Submit New Add-on）
4. 上传 `mailzip-<version>-amo.zip`（本次 0.2.7）
5. 表单 Source Code 问是否提交源码：用 esbuild/TS 打包 → 选 **Yes**，上传 `mailzip-<version>-src.zip`
6. 填 Release Notes（本文档 0.2.7 段落）→ 提交
7. 等待审核（更新版本通常自动过；抽查可能人工）
8. 审核通过即生效；驳回则按反馈修改后重提（同版本号可覆盖重传，上架成功后再升号）
