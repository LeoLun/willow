# Proposal: Monaco Editor 自动折行与禁用横向滚动条

## 动机

在 Willow 桌面应用中，文件管理侧边栏支持使用内联的 Monaco Editor 预览文件内容。目前，编辑器的配置项中 `wordWrap` 被设置为 `"off"`，这意味着当代码行长度超出编辑器视口宽度时，编辑器不会自动换行，而是产生一个横向滚动条。

为了提升在窄屏或侧边栏展开状态下的代码阅读体验，避免用户频繁进行横向滚动操作，我们希望对 Monaco Editor 进行优化：
1. **自动换行**：当单行内容超出编辑器容器宽度时，自动进行折行（Word Wrap）。
2. **隐藏横向滚动条**：确保在任何情况下都不会显示横向滚动条，使用户专注于纵向阅读。

## 目标

1. **启用自动折行**：将 Monaco Editor 实例的 `wordWrap` 属性配置为 `"on"`。
2. **禁用横向滚动**：通过配置 `scrollbar.horizontal` 选项或 CSS 规则，确保彻底不出现横向滚动条。
3. **保证性能与布局**：折行配置不会对编辑器的载入速度、内存占用或自适应容器布局（`automaticLayout`）产生负面影响。

## 方案设计

### 方案：优化 Monaco Editor 配置项

直接修改 `InlineFileViewer.vue` 中 `monaco.editor.create` 的配置参数：

1. **配置 `wordWrap: "on"`**：
   - 替换现有的 `wordWrap: "off"` 为 `wordWrap: "on"`。
   - 这会让 Monaco Editor 在边界位置不够时自动将文本折行到下一行。

2. **配置 `scrollbar`**：
   - 新增 `scrollbar` 配置，设置 `horizontal: "hidden"`。
   - 这将显式隐藏横向滚动条，配合 `wordWrap: "on"` 彻底消除横向滚动行为。

```typescript
editorInstance = monaco.editor.create(codeContainer.value, {
  // ... 其他配置项
  wordWrap: "on",
  scrollbar: {
    horizontal: "hidden",
  },
  // ... 其他配置项
});
```

#### 优点
- **实现简单且原生**：使用 Monaco Editor 官方提供的标准配置项，不引入额外的 DOM 包装或复杂的计算。
- **高性能**：Monaco Editor 内部的折行机制是高度优化的，不会造成渲染卡顿。
