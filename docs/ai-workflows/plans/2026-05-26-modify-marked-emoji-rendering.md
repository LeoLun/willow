# Execution Plan: 修改 marked 的 emoji 渲染，使用 OpenMoji 的样式

本计划将 OpenSpec 任务分解为具体的执行步骤，并明确了验证方法。

## 1. 任务背景与目标

为了解决使用 CDN 加载 SVG 图片时的裂图问题与 CSP 限制，本计划实施 **方案 B（本地托管 OpenMoji Color WOFF2 字体）**。通过在本地托管字体文件，并使用 Marked 扩展将 Unicode Emoji 包装在指定样式的 `<span>` 标签内，利用浏览器天然的字体渲染机制实现 OpenMoji 样式的渲染，做到 100% 离线可用。

---

## 2. 详细执行步骤

### 步骤 1: 下载并存放本地字体文件
- **字体名称**：`OpenMoji-Color.woff2` (COLRv0 格式，体积小且高压缩)
- **目标目录**：`packages/ui/src/assets/fonts/`
- **操作命令**：
  `curl -L -o packages/ui/src/assets/fonts/OpenMoji-Color.woff2 https://github.com/hfg-gmuend/openmoji/raw/master/font/OpenMoji-color-glyf_colr_0.woff2`
- **验证点**：文件成功下载至指定路径，大小约为 299KB。

### 步骤 2: 声明 `@font-face` 与 `.willow-emoji` 样式
- **目标文件**：`packages/ui/src/style.css`
- **修改内容**：
  1. 在文件顶部引入 `@font-face`，指向 `./assets/fonts/OpenMoji-Color.woff2`。
  2. 声明 `.willow-emoji` 样式，指定 `font-family: 'OpenMoji Color'` 优先，并回退到各平台的原生 Emoji 字体。
- **样式细节**：
  ```css
  .willow-emoji {
    font-family: 'OpenMoji Color', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji', sans-serif;
    display: inline-block;
    font-size: 1.25em;
    line-height: 1;
    vertical-align: -0.15em;
  }
  ```

### 步骤 3: 在 `MarkdownBlock.vue` 中修改 Marked 自定义 inline 扩展
- **目标文件**：`packages/ui/src/components/MarkdownBlock.vue`
- **修改内容**：
  在 `emoji` 扩展的 `renderer(token)` 逻辑中，直接将 Unicode Emoji 包装为 `<span class="willow-emoji">${token.emoji}</span>`。
- **验证点**：移除了先前的图片地址生成和 `onerror` 脚本逻辑，避免任何网络请求和 CSP 阻断风险。

### 步骤 4: 编译与手动验证
- **目标命令**：`pnpm lint && pnpm build`。
- **验证点**：
  1. 在 Mock 数据或任意 Markdown 文本中输入 Emojis。
  2. 使用浏览器审查元素，确认 Emoji 被包装在 `<span class="willow-emoji">` 内，且渲染为本地 OpenMoji Color 彩色字体。
  3. 彻底断开网络连接，验证其 100% 正常离线显示，无任何裂图。
