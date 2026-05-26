# Execution Plan: 侧边栏的文件管理支持使用 monaco-editor 打开文件（只读模式）

本计划将 OpenSpec 任务分解为具体的执行步骤，并明确了验证方法。

---

## 1. 详细执行步骤

### 步骤 1: 新增 IPC 协议支持与主进程实现
- **修改文件**：
  1. `app/work/src/shared/constants.ts`：添加 `READ_FILE` 常量。
  2. `app/work/src/shared/api.ts`：定义 `ReadFileRequest` 与 `ReadFileResponse` 接口类型。
  3. `app/work/src/preload/preload.ts`：在 `ipcObject` 中暴露 `readFile` 方法。
  4. `app/work/src/main/service/workspace.service.ts`：编写 `readWorkspaceFile(id: number, relativePath: string)` 逻辑，并在其中实现安全路径校验，只允许读取属于当前 Workspace 路径底下的文件。
  5. `app/work/src/main/controllers/workspace/read.file.controller.ts`：新建 Controller 类并实现 IPC 响应逻辑。
- **验证点**：使用单元测试或 preload 测试，确认通过 IPC 调用能够安全、正确地读取工作空间文件内容。

### 步骤 2: 在 `app/work` 中安装 `monaco-editor` 并配置 Web Workers
- **目标包**：`app/work`
- **操作命令**：
  在根目录运行 `pnpm --filter willow-work add monaco-editor`
- **打包环境配置**：
  在 `app/work/src/renderer/src/main.ts` 或相关入口中，配置 `window.MonacoEnvironment` 以支持 Monaco 的基本运行。由于只读预览通常不需要非常繁重的代码补全 worker，可以直接使用 `monaco-editor` 自带的内置 worker 机制或配置 ESM 加载器。
- **验证点**：运行 `pnpm build` 或 `pnpm dev` 没有发生 Monaco 打包编译错误。

### 步骤 3: 编写 `InlineFileViewer.vue` 文件预览组件与双栏布局
- **修改文件**：
  1. 新增 `app/work/src/renderer/src/pages/chat/session/components/InlineFileViewer.vue`：
     - 在挂载或 `filePath` 发生变化时调用 `electronAPI.readFile` 获取文件内容。
     - 初始化 `monaco.editor.create` 实例，注入只读配置（`readOnly: true`, `theme: 'vs-dark'`）。
     - 支持切换文件时重置编辑器模型或销毁重建，以实现文件内容更新。
     - 根据后缀自动推断设置 Monaco 语言。
     - 组件销毁时释放 Monaco 实例。
  2. 修改 `app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue`：
     - 将原本的 `files` 渲染标签页改为双栏布局：左侧固定宽度（如 `240px`）用于文件树展示；右侧自适应宽度用于渲染 `InlineFileViewer.vue`。
     - 使用 `provide` 往下层组件注入 `selectFile` 方法，并使用 `ref` 保存当前选中的文件路径与名称。
     - 当切换工作空间（`workspaceId` 改变）或标签页切换时，重置当前选中的文件状态为 `null`。

### 步骤 4: 挂载点击触发事件
- **修改文件**：
  `app/work/src/renderer/src/pages/chat/session/components/WorkspaceFileTree.vue`
- **修改内容**：
  - 移除了之前的 Dialog 弹出逻辑。
  - 使用 `inject` 获取 `selectFile` 接口，在点击文件节点时调用 `selectFile(item.path, item.name)` 触发右侧栏的内容加载。

---

## 2. 验证与回归测试计划

### 构建校验
- 运行 `pnpm lint` 验证无代码风格问题。
- 运行 `pnpm build` 确认项目正常编译发布。

### 手动功能校验
1. 打开侧边栏文件管理标签页。
2. 左侧展示文件树，右侧展示“选择一个文件以预览”的提示。
3. 点击一个 `.ts` / `.json` 文件，右侧部分应内联渲染 Monaco Editor 展开其内容，并高亮展示。
4. 验证在编辑器内无法执行任何写操作，仅可复制。
5. 切换工作空间，应重置当前预览的文件。
