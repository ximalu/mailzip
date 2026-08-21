# MailZip

Thunderbird 扩展：自动把符合条件的附件压缩为 ZIP。

在**两个时机**之一检查每个附件：**发送前**（点击发送时）或**添加附件后**（拖拽/添加按钮，立即处理）。当 **后缀匹配用户配置的压缩后缀列表** 且 **原始大小超过用户配置的阈值** 时，把该附件单独压缩为 `<原文件名>.zip`（ZIP 内只包含原文件本身），并替换原附件。

每个符合条件的附件单独压缩，不会合并多个附件。

## 功能

- **后缀匹配**：`stp, step, dwg, dxf` 等。自动处理大小写、前导点号（`.stp`）、空格、中英文逗号分隔；内部统一规范化为小写、不带点。
- **大小阈值**：按 MiB 输入（1 MB = 1,048,576 字节）。判定条件为 `fileSize > threshold`（严格大于，不含等于）。
- **压缩时机**（0.2.0 新增）：
  - **发送前**（默认）：点击发送时压缩，保持原行为。
  - **添加附件后**：监听 `compose.onAttachmentAdded`，附件一添加（鼠标拖拽多个文件或添加按钮）就立即处理。拖拽多个文件会逐个触发、排队串行处理。
- **两种处理方式**：
  - **自动压缩**：发现符合条件的附件直接压缩。
  - **询问后压缩**：弹出确认窗口，列出符合条件的附件及大小。按钮语义随时机自动切换：
    - 发送前：取消发送 / 不压缩继续发送 / 压缩后发送
    - 添加后：移除附件 / 保留原样 / 压缩替换
- **语言选择**（0.2.0 新增）：设置页可选择 **English（默认）** 或 **中文**，所有界面文案（设置页 + 询问窗口）即时切换并保存。
- **ZIP**：使用 [JSZip](https://github.com/Stuk/jszip)，Deflate 压缩，固定压缩级别 6；文件名 UTF-8；ZIP64 由 JSZip 自动处理。
- **不干扰原则**：没有符合条件的附件时，完全不介入 Thunderbird 的正常流程。

## 支持版本

- **Thunderbird 98+**（最低版本，`strict_min_version: "98.0"`）。
  - `compose.onBeforeSend`：TB 74+
  - `compose.onAttachmentAdded` / `onAttachmentRemoved`：TB 78+
  - `compose.listAttachments` / `removeAttachment` / `addAttachment`：TB 78+
  - `ComposeAttachment.size`：TB 83+
  - `compose.getAttachmentFile` / `FileAttachment`：TB 98+
- Manifest V2（MV2）。Thunderbird 对 MV3 的 `compose` API 支持仍在演进，MV2 是 Thunderbird 扩展生态的稳定基线。

## 使用的核心 API

| API | 用途 |
|-----|------|
| `compose.onBeforeSend` | 用户点击发送时拦截，返回 `{ cancel, details }` 控制是否继续发送 |
| `compose.onAttachmentAdded` | 附件添加到 Compose 窗口时触发（拖拽/添加按钮均触发，每个附件一次） |
| `compose.listAttachments(tabId)` | 列出 Compose 窗口当前附件（含 `id`、`name`、`size`） |
| `compose.getAttachmentFile(id)` | 读取附件内容为 `File` |
| `compose.removeAttachment(tabId, id)` | 删除原附件 |
| `compose.addAttachment(tabId, FileAttachment)` | 添加 ZIP 附件 |
| `storage.local` | 保存设置 |

**发送拦截可行性**（2026-08 调研确认）：官方 API 完全支持"发送前获取附件 → 读取内容 → 删除 → 添加替换附件 → 继续发送"的完整链路，**不需要 native host**。`onBeforeSend` 的 listener 可返回 Promise（异步 listener），Thunderbird 会等待处理完成后发送。

## 项目结构

```
mailzip/
├── manifest.json          # MV2 manifest（gecko id + strict_min_version 98.0）
├── package.json           # npm 脚本：build / test / typecheck
├── build.js               # esbuild 打包：src/*.ts → dist/*.js + 静态资源复制
├── scripts/gen-icons.py   # 生成应用图标（PIL，48/96/128）
├── src/
│   ├── background.ts      # onBeforeSend + onAttachmentAdded 主流程（含防递归、串行队列）
│   ├── options.html/ts    # 设置界面（语言 / 时机 / 模式 / 后缀阈值）
│   ├── ask.html/ts        # 询问模式确认窗口（按时机渲染选项语义）
│   ├── icons/             # 应用图标（48/96/128 PNG）
│   └── lib/
│       ├── config.ts      # 后缀解析 / 阈值解析 / 匹配规则（纯逻辑，可单测）
│       ├── storage.ts     # 设置持久化（storage.local）
│       ├── i18n.ts        # en/zh 双语字典 + t() 渲染（纯逻辑，可单测）
│       └── zipper.ts      # JSZip 封装（ZIP 生成）
├── tests/                 # vitest 单元测试
└── dist/                  # 构建产物（安装时加载此目录）
```

## 开发

环境：Node 18+，npm。

```bash
npm install                 # 安装依赖（中国网络建议先 npm config set registry https://registry.npmmirror.com）
npm run typecheck           # TypeScript 类型检查
npm test                    # 单元测试（vitest）
npm run build               # 构建到 dist/
```

### 单元测试

覆盖：后缀解析（大小写 / 点号 / 空格 / 中英文逗号 / 空条目）、阈值解析（整数 / 小数 / 非法输入）、匹配规则（双条件 / 严格大于 / 大小写不敏感 / 空配置）、ZIP 文件名、ZIP 格式（magic bytes / UTF-8 文件名 / 内容 round-trip）、i18n（双语键一致性 / 非空 / 参数替换 / 缺键 fallback）。

```bash
npm test
```

### 在 Thunderbird 中安装（临时加载）

1. `npm run build` 生成 `dist/`
2. Thunderbird → 菜单 ☰ → **附加组件和主题** → 齿轮图标 → **调试附加组件**
3. 点击 **临时载入附加组件** → 选择 `dist/manifest.json`
4. 在 Thunderbird 设置页（扩展管理或右键扩展 → 首选项）配置：后缀、大小阈值、处理方式、压缩时机、语言

> ⚠️ manifest 内路径是相对扩展根（`dist/`）的写法（`background.js` / `options.html` / `ask.html`）。修改路径后要**先移除再重新临时载入**；临时加载每次 UUID 会变，旧的 `moz-extension://` URL 作废，请从附加组件管理器入口打开设置页。

> 临时加载的扩展在 Thunderbird 重启后会失效，重新加载即可。正式分发需打包签名（AMO）。

### 手工测试流程

**发送前模式（on-send，默认）**

1. 准备测试文件：`test.stp`（> 阈值）、`small.stp`（< 阈值）、`photo.jpg`（> 阈值，但后缀不匹配）
2. 配置后缀 `stp`、阈值 `1`、时机"发送前"
3. 写新邮件，添加上述三个附件，发送：
   - ✅ `test.stp` 被替换为 `test.stp.zip`
   - ✅ `small.stp` 保持原样
   - ✅ `photo.jpg` 保持原样
4. 检查收件端：ZIP 可正常解压，内部文件名与内容正确
5. 切换"询问后压缩"模式，验证三个选项：取消发送 / 不压缩继续发送 / 压缩后发送
6. 无符合条件附件时（例如只有 `photo.jpg`），发送流程应与未装扩展时完全一致

**添加后模式（on-add）**

1. 配置时机"添加附件后"
2. 写新邮件，**一次性拖拽** `test.stp` + `small.stp` + `photo.jpg` 进写邮件窗口：
   - ✅ `test.stp` 添加后立即变为 `test.stp.zip`（无需点击发送）
   - ✅ `small.stp` / `photo.jpg` 保持原样
3. 切换"询问后压缩"：再拖入一个匹配文件，应弹出确认窗口，三个选项为：移除附件 / 保留原样 / 压缩替换
4. 确认被替换的 zip **不会再次被压缩**（防递归生效，不会无限循环）
5. 发送邮件，收件端 ZIP 正常

## 已知限制

- **`onBeforeSend` 异步 listener 类型**：`@types/thunderbird-webext-browser` 尚未声明 async listener 支持，代码中通过类型断言处理（Thunderbird 官方文档明确支持异步 listener，见 `src/background.ts` 注释）。
- **询问模式的确认窗口**：使用 `windows.create` 弹出小窗口。实测若 Thunderbird 对用户输入事件有超时限制，超大附件的压缩可能触发超时——如遇此情况请改用自动模式，或在 README 更新说明。
- **添加后模式逐个询问**：拖拽多个匹配文件 + 询问模式时，每个附件弹一次确认窗口（逐个串行）。不接受批量合并确认。
- **不做压缩收益判断**：不检查压缩后是否更小，不按文件类型智能判断，严格执行配置规则。
- **ZIP 仅第一版**：不实现 7z。
- **压缩失败策略**：ZIP 生成失败时不做任何附件修改，按原附件继续，并在后台日志记录错误（不会静默丢附件）。

## 版本履历

### 0.2.3（2026-08-21）

- 修复 AMO validator 的 DANGEROUS_EVAL 警告：JSZip 依赖的 npm `setimmediate` 包含 `new Function`，通过 esbuild `platform=neutral` + alias 替换为无 eval 的 setTimeout shim（`src/lib/setimmediate-shim.cjs`、`readable-stream-shim.cjs`）
- web-ext lint：errors 0 / warnings 1（仅剩 compose 权限误报）

### 0.2.2（2026-08-21）

- 新增应用图标（48/96/128，`scripts/gen-icons.py` 生成），manifest 补 `icons` 字段
- manifest description 完善（面向 ATN 商店展示）
- 准备 addons.thunderbird.net 上架（listed 公开路线）

### 0.2.1（2026-08-21）

- 调整设置页布局顺序：语言选择 → 压缩时机 → 处理方式 → 后缀/阈值

### 0.2.0（2026-08-21）

- 新增：**压缩时机** —— 发送前（默认）/ 添加附件后（`compose.onAttachmentAdded`，拖拽多文件逐个串行处理）
- 新增：**语言选择** —— 默认英文，可改中文；全部界面文案 i18n 化（`src/lib/i18n.ts`）
- 新增：询问窗口选项按时机自适应（发送前：取消/原样/压缩后发送；添加后：移除/保留/压缩替换）
- 实现：防递归保护（跳过自己生成的 zip）、串行队列（避免并发 remove/add 冲突与弹窗覆盖）
- 修复：manifest 路径改为相对扩展根（此前 `dist/` 前缀导致设置页空白、background 不生效）

### 0.1.0（2026-08-21）

- 初始版本：发送前自动压缩 / 询问压缩，后缀 + 大小阈值匹配

## License

MIT
