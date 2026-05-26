# Design: 侧边栏的文件管理支持使用 monaco-editor 打开文件（只读模式）

## 技术决策

### 1. IPC 接口设计
我们需要新增一个 IPC 接口以从主进程读取指定路径的文件内容：
- **IPC 常量**: `READ_FILE` (值: `"READ_FILE"`)
- **API 请求接口**:
  ```typescript
  export interface ReadFileRequest {
    path: string;
  }
  export interface ReadFileResponse {
    content: string;
    encoding: string;
  }
  ```
- **Controller 层**: 新建 `ReadFileController` 用于拦截该 IPC 调用。
- **Service 层**: `WorkspaceService` 新增 `readWorkspaceFile(filePath: string)` 方法，仅允许读取工作空间目录下的文件（防止路径穿越安全风险）。

### 2. 前端双栏布局与内联编辑器设计
在右侧边栏的“文件”标签页下，不再使用弹窗形式展示代码，而是将文件标签页内部拆分为**左右双栏布局**：
- **左栏（文件树）**：宽度固定或设定为如 `240px`，内部是原有的工作空间文件树。
- **右栏（编辑器）**：自适应剩余宽度，内部直接嵌入一个 Monaco Editor，当用户在左侧选择文件时，右侧内联加载并展示文件内容。
- **Provide/Inject 通信**：由于文件树是递归组件，我们在 `ChatRightSidebar.vue` 中提供（`provide`）选择文件的回调函数，各级子节点在被点击时直接注入（`inject`）并调用该函数，从而在右侧栏渲染该文件。

### 3. Monaco Editor 载入与配置
- 将 `monaco-editor` 作为 renderer 的依赖安装，并在客户端代码中按需引入。
- 为了避免 Monaco Editor 的 Web Workers 配置过于复杂，利用 Vite 的 `import.meta.url` 或配置 `window.MonacoEnvironment` 以支持语法高亮和编辑器的正确运行。
- 提供切换文件时销毁或重用 Monaco 编辑器实例的逻辑（或者当 `selectedFilePath` 改变时重新载入/更新编辑器中的 Model）。
- 在组件销毁（`onBeforeUnmount`）时释放 Monaco 实例。

### 4. 触发逻辑
- 修改 `WorkspaceFileTree.vue` 中的文件节点，为文件节点绑定点击事件。
- 点击时调用注入的 `selectFile(item.path, item.name)` 方法。
