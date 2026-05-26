# 设计文档：修改 marked 的 emoji 渲染

## 架构设计

根据对“不使用 CDN 图标”和“防止裂图”的反馈，本设计将不再采用任何外部 `<img>` 链接。我们重新设计了以下两个具体的本地化实现方案：

### 方案 A 设计：系统原生 Emoji 渲染（无网络依赖）

1. **基本原理**：
   无需将 Emoji 替换为 `<img>` 标签。直接让 `marked` 将 Unicode 字符原样输出。
2. **样式调优**：
   在 `packages/ui/src/style.css` 中，为 markdown 内容或特定文本段落添加更符合现代系统的 emoji 字体回退：
   ```css
   .markdown-body {
     font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial,
                  "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif;
   }
   ```
   这能确保系统以最佳的本地 Emoji 字体渲染，无任何请求开销。
3. **回滚改动**：
   移出 `MarkdownBlock.vue` 中先前添加的 `emoji` inline 扩展，保持 markdown 树的解析纯净。

### 方案 B 设计：本地托管 OpenMoji Color WOFF2 字体

1. **资源配置**：
   从 OpenMoji 官方库中获取本地 `OpenMoji-Color.woff2` 字体文件，并放入 `packages/ui/src/assets/fonts/` 目录中。
2. **CSS 字体声明**：
   在 `packages/ui/src/style.css` 中声明自定义字体：
   ```css
   @font-face {
     font-family: 'OpenMoji Color';
     src: url('./assets/fonts/OpenMoji-Color.woff2') format('woff2');
     font-display: swap;
   }
   ```
3. **字体应用**：
   为 Emoji 文本或者 markdown 整体样式添加字体支持：
   ```css
   .markdown-body {
     font-family: 'OpenMoji Color', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif;
   }
   ```
   当遇到 Emoji 码点时，浏览器会自动从 `OpenMoji Color` 字体中渲染出 OpenMoji 样式的彩色 Emoji。
