# 任务列表

## 1. 优化 Monaco Editor 配置项
- [ ] 修改 `app/work/src/renderer/src/pages/chat/session/components/InlineFileViewer.vue` 中的 `monaco.editor.create` 配置：
  - 将 `wordWrap` 属性的值从 `"off"` 修改为 `"on"`。
  - 新增 `scrollbar` 对象配置，并设置其属性 `horizontal` 为 `"hidden"`。

## 2. 验证与构建
- [ ] 运行 `pnpm lint` 校验代码风格。
- [ ] 运行 `pnpm build` 确认项目可以正常无错构建。
- [ ] 运行 `pnpm dev` 启动 Electron 应用，选中超长单行的文件进行内联预览，验证：
  - 代码在视口宽度不足时自动换行。
  - 无横向滚动条出现，且无法进行横向滚动。
