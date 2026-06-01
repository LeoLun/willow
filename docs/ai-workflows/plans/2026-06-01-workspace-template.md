# Execution Plan: 添加工作空间时支持选择模板

根据已制定的 OpenSpec 设计规范，本计划旨在指导在创建/添加工作空间时支持选择内置模板（模板类似 `builtin-skills` 放到包里）的开发工作。

## 1. 目标与范围

- 修改目标文件：
  - IPC 类型与常量：[api.ts](file:///Users/liujinglun/code/willow/app/work/src/shared/api.ts), [constants.ts](file:///Users/liujinglun/code/willow/app/work/src/shared/constants.ts), [preload.ts](file:///Users/liujinglun/code/willow/app/work/src/preload/preload.ts), [workspace.hook.ts](file:///Users/liujinglun/code/willow/app/work/src/shared/hook/workspace.hook.ts)
  - 构建配置：[forge.config.mjs](file:///Users/liujinglun/code/willow/app/work/forge.config.mjs)
  - 主进程服务与控制器：[workspace.service.ts](file:///Users/liujinglun/code/willow/app/work/src/main/service/workspace.service.ts), [create.workspace.controller.ts](file:///Users/liujinglun/code/willow/app/work/src/main/controllers/workspace/create.workspace.controller.ts), [app.module.ts](file:///Users/liujinglun/code/willow/app/work/src/main/app.module.ts)
  - 渲染进程 UI 界面：[CreateWorkspace.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer/src/layout/dialog/create-workspace/CreateWorkspace.vue)
- 新增目标文件与目录：
  - 新增主进程控制器：`get.workspace.templates.controller.ts`
  - 新增项目模版目录：`app/work/templates/`

- 主要修改内容：
  - 更新打包配置 `forge.config.mjs`，将 `./templates` 作为 `extraResource` 打包。
  - 主进程新增 `GET_WORKSPACE_TEMPLATES` 接口以扫描内置模板目录（开发阶段为 `app/work/templates/`，生产打包后为 `process.resourcesPath/templates/`），读取 `template.json` 配置以及预览图 Base64 并返回给渲染进程。
  - 主进程修改 `CREATE_WORKSPACE` 接口逻辑：若传递了 `templateId`，则把 zip 拷贝到新创建的工作空间下，并自动创建一个初始 Session，最后返回 `{ workspace, session, zipFileName }`。
  - 渲染进程升级 `CreateWorkspace.vue` 弹窗，拉取模板列表并以卡片网格形式展示，支持单选模板。
  - 创建带有模板的工作空间成功后，渲染进程自动跳转到新会话并自动下发指令 `解压「<文件名>.zip」包到当前目录`。

---

## 2. 详细执行步骤

### 步骤 1：定义共享层 IPC 接口及 API 类型
- 打开 [api.ts](file:///Users/liujinglun/code/willow/app/work/src/shared/api.ts)：
  - 定义 `WorkspaceTemplate`、`GetWorkspaceTemplatesResponse` 结构。
  - 扩展 `CreateWorkspaceRequest` 和 `CreateWorkspaceResponse` 结构。
- 打开 [constants.ts](file:///Users/liujinglun/code/willow/app/work/src/shared/constants.ts) 新增 `GET_WORKSPACE_TEMPLATES` 常量。
- 打开 [preload.ts](file:///Users/liujinglun/code/willow/app/work/src/preload/preload.ts) 注册 `getWorkspaceTemplates` 的 Electron 桥接 API。
- 打开 [workspace.hook.ts](file:///Users/liujinglun/code/willow/app/work/src/shared/hook/workspace.hook.ts) 在接口中添加新方法的签名。

### 步骤 2：打包配置调整
- 打开 [forge.config.mjs](file:///Users/liujinglun/code/willow/app/work/forge.config.mjs)：
  - 在 `packagerConfig.extraResource` 数组中添加 `"./templates"` 确保模板目录在打包时被复制到 resources 路径下。

### 步骤 3：实现主进程模板解析与拷贝逻辑
- 打开 [workspace.service.ts](file:///Users/liujinglun/code/willow/app/work/src/main/service/workspace.service.ts)：
  - 实现内置模板目录计算方法 `getTemplatesDir()`:
    ```typescript
    private getTemplatesDir(): string {
      return app.isPackaged
        ? join(process.resourcesPath, "templates")
        : join(app.getAppPath(), "templates");
    }
    ```
  - 实现 `getWorkspaceTemplates()`：
    - 读取 `getTemplatesDir()` 目录下的所有子文件夹。
    - 读取各子文件夹下的 `template.json`。
    - 读取预览图文件（支持 .png / .jpg / .jpeg / .webp）并转换为 Base64 编码的 Data URL。
    - 将解析成功的模板以列表形式返回给前端。
  - 重构 `createWorkspace` 和 `createDefaultWorkspace` 方法，支持 `templateId?: string` 传入：
    - 根据 `templateId` 在 `getTemplatesDir()` 中定位对应的 zip 文件。
    - 工作空间物理文件夹创建成功后，调用 `fs.promises.cp(srcZip, destZip)` 将 zip 压缩包复制到工作空间根目录下。

### 步骤 4：实现主进程控制器与路由注册
- 新建 `get.workspace.templates.controller.ts`：
  - 实现处理 `GET_WORKSPACE_TEMPLATES` 接口逻辑，调用 `workspaceService.getWorkspaceTemplates()`。
- 打开 [create.workspace.controller.ts](file:///Users/liujinglun/code/willow/app/work/src/main/controllers/workspace/create.workspace.controller.ts)：
  - 构造函数注入 `SessionService`。
  - 当 `request.templateId` 存在时，拷贝 zip 文件完成后调用 `sessionService.createSession(workspace.id)` 创建初始会话。
  - 返回 `{ workspace, session, zipFileName }`。
- 打开 [app.module.ts](file:///Users/liujinglun/code/willow/app/work/src/main/app.module.ts)：
  - 注册 `GetWorkspaceTemplatesController`。

### 步骤 5：升级渲染进程模板选择弹窗与自动消息处理
- 打开 [CreateWorkspace.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer/src/layout/dialog/create-workspace/CreateWorkspace.vue)：
  - 导入 Pinia 的 `useWorkspaceStore`, `useSessionStore` 和 vue-router 的 `useRouter`。
  - 在 `onBeforeMount` 时，调用 `electronAPI.getWorkspaceTemplates` 异步获取模板列表。
  - 在目录选择下方添加“选择模板（可选）”区域，卡片网格渲染模板的预览图、名称、描述。
  - 支持选中卡片与取消选中高亮状态。
  - 提交表单时，如果返回的结果有 `session` 和 `zipFileName`，在 `emit("close")` 之后：
    - 刷新 `workspaceStore.fetchWorkspaceList()` 与 `sessionStore.fetchSessionList(...)`。
    - 展开新创建的工作空间节点：`workspaceStore.setWorkspaceExpanded(workspace.id, true)`。
    - 自动导航至新建的 Session 会话：`router.push(`/${session.id}`)`。
    - 导航成功后使用 `setTimeout` 延迟 500ms，触发向 AI 发送默认解压消息：`electronAPI.sendMessage({ sessionId: session.id, message: "解压「" + zipFileName + "」包到当前目录" })`。

### 步骤 6：准备内置模板目录
- 在 `app/work/` 下新建 `templates` 目录。
- 新建子目录 `app/work/templates/financial-management`。
- 新建 `app/work/templates/financial-management/template.json`：
  ```json
  {
    "id": "financial-management",
    "name": "金融管理",
    "description": "内置金融数据处理 Skill 及模板应用代码，可进行行业报表分析及自动化理财计算。",
    "zipFileName": "金融管理.zip",
    "previewFileName": "preview.png"
  }
  ```
- 放入预览图 `preview.png` 和 mock 压缩包 `金融管理.zip`。

### 步骤 7：代码校验与打包测试
- 执行 `pnpm lint` 排除静态代码问题。
- 执行 `pnpm build` 进行全量编译打包测试，验证 `forge.config.mjs` 正确将 `templates` 复制到包中。

### 步骤 8：本地手动验证 (Manual Verification)
- 运行 `pnpm dev` 启动 Electron 应用。
- 点击“创建新工作空间”。
- 确认在弹窗中展示有“金融管理”模板，显示了预览图。
- 选中模板并创建，输入名字 "我的金融应用"，点击确认。
- 确认界面自动跳转至新生成的 Session 聊天页面，左侧列表的新工作空间节点自动展开。
- 确认在当前 Session 下自动以用户身份发出了消息：`解压「金融管理.zip」包到当前目录`。
- 打开本地生成的工作空间目录，验证 `金融管理.zip` 已成功拷贝至该目录。

---

## 3. 依赖项与前置条件

- 本次修改涉及构建配置、共享层类型声明、主进程服务及接口逻辑、渲染进程 UI 及交互逻辑。

## 4. 终止与回滚条件

- 若模板的预览图太大导致转 base64 占内存或加载过长，应限制图片的最大体积或默认使用内置缺省图。
- 拷贝文件若由于权限报错，需增加异常拦截，防止整个工作空间创建事务崩溃。

---
下一步：运行 `workflow-worktree` 阶段在干净的工作树中进行实施，或者运行 `workflow-implement` 阶段执行上述步骤。
