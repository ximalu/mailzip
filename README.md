# MailZip

Thunderbird 扩展：发送邮件时自动把符合条件的附件压缩为 ZIP。

发送前检查每个附件：**后缀匹配用户配置的压缩后缀列表** 且 **原始大小超过用户配置的阈值** 时，把该附件单独压缩为 `<原文件名>.zip`（ZIP 内只包含原文件本身），并替换原附件。

每个符合条件的附件单独压缩，不会合并多个附件。

## 功能

- **后缀匹配**：`stp, step, dwg, dxf` 等。自动处理大小写、前导点号（`.stp`）、空格、中英文逗号分隔；内部统一规范化为小写、不带点。
- **大小阈值**：按 MiB 输入（1 MB = 1,048,576 字节）。判定条件为 `fileSize > threshold`（严格大于，不含等于）。
- **两种处理方式**：
  - **自动压缩**：发现符合条件的附件直接压缩并继续发送。
  - **询问后压缩**：发送前弹出确认窗口，列出符合条件的附件及大小，可选择：取消发送 / 不压缩继续发送 / 压缩后发送。
- **ZIP**：使用 [JSZip](https://github.com/Stuk/jszip)，Deflate 压缩，固定压缩级别 6；文件名 UTF-8；ZIP64 由 JSZip 自动处理。
- **不干扰原则**：没有符合条件的附件时，完全不介入 Thunderbird 的正常发送流程。

## 支持版本

- **Thunderbird 98+**（最低版本，`strict_min_version: "98.0"`）。
  - `compose.onBeforeSend`：TB 74+
  - `compose.listAttachments` / `removeAttachment` / `addAttachment`：TB 78+
  - `ComposeAttachment.size`：TB 83+
  - `compose.getAttachmentFile` / `FileAttachment`：TB 98+
- Manifest V2（MV2）。Thunderbird 对 MV3 的 `compose` API 支持仍在演进，MV2 是 Thunderbird 扩展生态的稳定基线。

## 使用的核心 API

| API | 用途 |
|-----|------|
| `compose.onBeforeSend` | 用户点击发送时拦截，返回 `{ cancel, details }` 控制是否继续发送 |
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
├── src/
│   ├── background.ts      # onBeforeSend 拦截主流程
│   ├── options.html/ts    # 设置界面（后缀 / 阈值 / 模式）
│   ├── ask.html/ts        # 询问模式确认窗口
│   └── lib/
│       ├── config.ts      # 后缀解析 / 阈值解析 / 匹配规则（纯逻辑，可单测）
│       ├── storage.ts     # 设置持久化（storage.local）
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

覆盖：后缀解析（大小写 / 点号 / 空格 / 中英文逗号 / 空条目）、阈值解析（整数 / 小数 / 非法输入）、匹配规则（双条件 / 严格大于 / 大小写不敏感 / 空配置）、ZIP 文件名、ZIP 格式（magic bytes / UTF-8 文件名 / 内容 round-trip）。

```bash
npm test
```

### 在 Thunderbird 中安装（临时加载）

1. `npm run build` 生成 `dist/`
2. Thunderbird → 菜单 ☰ → **附加组件和主题** → 齿轮图标 → **调试附加组件**
3. 点击 **临时载入附加组件** → 选择 `dist/manifest.json`
4. 在 Thunderbird 设置页（扩展管理或右键扩展 → 首选项）配置：后缀、大小阈值、处理方式

> 临时加载的扩展在 Thunderbird 重启后会失效，重新加载即可。正式分发需打包签名（AMO）。

### 手工测试流程（发送链路验证）

1. 准备测试文件：`test.stp`（> 阈值）、`small.stp`（< 阈值）、`photo.jpg`（> 阈值，但后缀不匹配）
2. 配置后缀 `stp`、阈值 `1`
3. 写新邮件，添加上述三个附件，发送：
   - ✅ `test.stp` 被替换为 `test.stp.zip`
   - ✅ `small.stp` 保持原样
   - ✅ `photo.jpg` 保持原样
4. 检查收件端：ZIP 可正常解压，内部文件名与内容正确
5. 切换"询问后压缩"模式，验证三个选项：取消发送 / 不压缩继续发送 / 压缩后发送
6. 无符合条件附件时（例如只有 `photo.jpg`），发送流程应与未装扩展时完全一致

## 已知限制

- **`onBeforeSend` 异步 listener 类型**：`@types/thunderbird-webext-browser` 尚未声明 async listener 支持，代码中通过类型断言处理（Thunderbird 官方文档明确支持异步 listener，见 `src/background.ts` 注释）。
- **询问模式的确认窗口**：使用 `windows.create` 弹出小窗口。实测若 Thunderbird 对用户输入事件有超时限制，超大附件的压缩可能触发超时——如遇此情况请改用自动模式，或在 README 更新说明。
- **不做压缩收益判断**：不检查压缩后是否更小，不按文件类型智能判断，严格执行配置规则。
- **ZIP 仅第一版**：不实现 7z。
- **压缩失败策略**：ZIP 生成失败时不做任何附件修改，按原附件继续发送，并在后台日志记录错误（不会静默丢附件）。

## License

MIT
