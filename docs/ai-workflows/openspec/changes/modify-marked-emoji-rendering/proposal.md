# Proposal: 修改 marked 的 emoji 渲染，使用 OpenMoji 的样式

## 动机

当前 Willow 的 Markdown 渲染组件中，Emoji 直接渲染为系统默认的 Unicode 字符。为了统一不同操作系统（macOS、Windows、Linux）下的视觉体验，提供更加精美、一致且具有 Willow 特色的工作空间质感，我们计划修改 `marked` 的 emoji 渲染逻辑，采用开源的 **OpenMoji** 样式。

但是在实施过程中发现，如果使用 **CDN 加载 SVG 图片**，在离线、网络受限或存在严格 Content Security Policy (CSP) 的 Electron 渲染进程中，会出现图片加载失败（裂图）且 `onerror` 脚本执行受阻的问题。为了确保 100% 离线可用和高性能渲染，我们需要调整为**不依赖 CDN** 的本地渲染策略。

## 目标

1. **统一 Emoji 样式且无网络依赖**：采用本地托管的 OpenMoji 资源或系统原生字体渲染，避免从任何 CDN 获取图片。
2. **良好的排版与对齐**：确保渲染出的 Emoji 在多行文本和标题中排版自然，避免出现抖动或撑开行高。
3. **安全与稳定性**：不使用易受 CSP 限制的 inline event handler（如 `onerror`），100% 本地渲染。

## 可选方案对比

### 方案 A：恢复使用系统原生 Emoji 字体（推荐）
直接渲染为 Unicode 文本字符，不使用任何 `<img>` 标签或外部资源，完全由操作系统自带的 emoji 字体（如 macOS 的 Apple Color Emoji，Windows 的 Segoe UI Emoji）提供渲染。
- **优点**：最轻量、100% 离线可用、渲染速度最快、支持所有复杂的最新复合 Emoji，无任何兼容性问题。
- **缺点**：不同操作系统上看到的 Emoji 视觉风格不完全一致（如 Windows 和 macOS 的风格不同）。

### 方案 B：使用本地托管的 OpenMoji Color WOFF2 字体
将 OpenMoji 官方提供的 `OpenMoji-Color.woff2` 字体文件（约 5.5MB）下载并内置到项目的本地资源目录中，通过 CSS `@font-face` 加载，并将 Markdown 内的 Emoji 文本样式设置为 `font-family: 'OpenMoji Color'`。
- **优点**：能够完美统一各操作系统的视觉样式为 OpenMoji，且 100% 离线可用。
- **缺点**：会使应用安装包体积增加约 5MB；同时，由于 OpenMoji 字体是基于 COLRv1 规范构建，部分旧版本 Electron 内核可能存在渲染兼容性问题。

### 方案 C：使用本地 SVG 精简包
只将一部分高频使用的常用 Emoji SVG 资源（如 100 个左右）打包内置到应用静态资源中，其它低频 Emoji 自动降级为原生文本。
- **优点**：不增加太多体积，且高频 Emoji 样式统一。
- **缺点**：维护复杂，对罕见/复合 Emoji 支持不全。

## 方案推荐

**推荐选择 方案 A（系统原生 Emoji）**，它是最健壮、最符合 Electron 桌面应用离线优先规范的设计。如果必须强制要求 OpenMoji 的视觉统一，则选择 **方案 B**。

---
