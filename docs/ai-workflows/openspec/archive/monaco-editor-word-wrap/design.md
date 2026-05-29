# 设计文档：Monaco Editor 自动折行与禁用横向滚动条

## 修改范围

主要涉及内联文件预览组件：
- [InlineFileViewer.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer/src/pages/chat/session/components/InlineFileViewer.vue)

## 详细设计

在 `InlineFileViewer.vue` 中的 `monaco.editor.create` 方法中，更新相关选项：

```typescript
      editorInstance = monaco.editor.create(codeContainer.value, {
        value: response.content,
        language: language,
        theme: isDark.value ? "vs-dark" : "vs",
        readOnly: true,
        domReadOnly: true,
        automaticLayout: true,
        minimap: { enabled: false },
        wordWrap: "on", // 变更为 "on" 以启用自动换行
        scrollbar: {
          horizontal: "hidden", // 显式隐藏横向滚动条并禁用横向滚动交互
        },
        fontSize: 13,
        fontFamily: 'Consolas, "Liberation Mono", Menlo, Courier, monospace',
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        folding: true,
      });
```

### 1. `wordWrap: "on"`
- 作用：控制编辑器是否应折行。设置为 `"on"` 时，编辑器将在视口宽度处进行折行。

### 2. `scrollbar.horizontal: "hidden"`
- 作用：隐藏横向滚动条。与 `wordWrap: "on"` 配合，实现完美的不留空白和滚动条的代码浏览体验。
- 注：Monaco Editor 的滚动条配置在 `scrollbar` 对象中，类型定义支持 `'auto' | 'visible' | 'hidden'`。
