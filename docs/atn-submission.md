# ATN 上架材料（addons.thunderbird.net）

> 用途：MailZip 公开上架（listed 路线）的提交资料。2026-08-21 准备。

## 提交 zip

- 位置：`dist/` 内容打包，manifest.json 在 zip 根
- 打包命令：`cd dist && zip -r ../mailzip-<version>-amo.zip .`
- 上传文件：`mailzip-0.2.2-amo.zip`（123pan VPS-hermes/20260821/）

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

1. `MANIFEST_PERMISSIONS: Invalid permissions "compose"` — web-ext (Firefox linter) 不认识 Thunderbird 特有权限，误报。compose 是官方 Thunderbird 权限（webextension-api.thunderbird.net），ATN validator 认识。

DANGEROUS_EVAL 已于 0.2.3 消除（setimmediate 包 alias 为无 eval shim），不应再出现。

## 提交流程

1. 注册/登录 Mozilla 账号
2. 打开 https://addons.thunderbird.net/en-US/developers/ 接受开发者协议
3. Submit New Add-on → 选择 "On this site"（listed 公开列表）
4. 上传 `mailzip-<version>-amo.zip`
5. 填写商店信息（上表）→ 平台选 Thunderbird → 提交
6. 等待人工审核（数天~数周；compose 权限会触发人工审核）
7. 审核通过后上架；审核驳回则按反馈修改重新提交
