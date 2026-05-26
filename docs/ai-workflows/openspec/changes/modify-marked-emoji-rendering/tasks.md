# 任务列表

## 1. 扩展 Marked 解析器支持 Emoji
- [x] 在 `packages/ui/src/components/MarkdownBlock.vue` 中定义 `EMOJI_REGEX` 与 `marked` 的自定义 inline 扩展。
- [x] 将自定义扩展追加到 `marked.use({ extensions: [...] })` 中。
- [x] 确保在渲染器中通过码点映射逻辑生成 OpenMoji SVG 地址，并附加 `onerror="this.outerHTML=this.alt"` 属性。

## 2. 样式调优与对齐
- [x] 在 `packages/ui` 相关样式文件（或 `MarkdownBlock.vue` 的 `<style>` 块）中加入对 `.willow-emoji` 的 CSS 样式声明。
- [x] 验证在不同字号（例如普通段落、H1-H6 标题）下的对齐和显示效果。

## 3. 兼容性与边界测试
- [x] 确保代码块 (CodeBlock) 和行内代码中的 Emoji 保持原样不被替换。
- [x] 测试单码点 Emoji (如 😀)、修饰符 Emoji (如 👍🏽) 和复杂 ZWJ 序列 Emoji (如 👨‍👩‍👧‍👦)。
- [x] 模拟离线环境，验证图片加载失败后的自动降级（退回到 Unicode 文本）效果是否符合预期。

## 4. 构建与回归验证
- [x] 运行 `pnpm lint` 检查代码风格。
- [x] 运行 `pnpm build` 确认项目编译正常。
- [x] 在 UI Playground (`pnpm dev:ui`) 或主应用 (`pnpm dev`) 中验证 Emoji 的渲染效果。
