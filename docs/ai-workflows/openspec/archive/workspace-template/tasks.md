# 任务列表

## 1. 扩展数据结构与 constants 定义

- [ ] 在 [shared/api.ts](file:///Users/liujinglun/code/willow/app/work/src/shared/api.ts) 中：
  - 新增 `WorkspaceTemplate` 接口。
  - 新增 `GetWorkspaceTemplatesResponse` 接口。
  - 扩展 `CreateWorkspaceRequest` 接口，添加可选字段 `templateId: string`。
  - 扩展 `CreateWorkspaceResponse` 接口，添加可选字段 `session: Session` 与 `zipFileName: string`。
- [ ] 在 [shared/constants.ts](file:///Users/liujinglun/code/willow/app/work/src/shared/constants.ts) 中新增常量 `GET_WORKSPACE_TEMPLATES`。

## 2. Preload 接口定义与注册

- [ ] 在 [preload/preload.ts](file:///Users/liujinglun/code/willow/app/work/src/preload/preload.ts) 中：
  - 在 `ipcObject` 中注册 `getWorkspaceTemplates`。
  - 修改 `createWorkspace` 的类型定义以支持新的入参和返回参数。
- [ ] 在 [shared/hook/workspace.hook.ts](file:///Users/liujinglun/code/willow/app/work/src/shared/hook/workspace.hook.ts) 中更新接口定义。

## 3. 构建配置升级

- [ ] 在 [forge.config.mjs](file:///Users/liujinglun/code/willow/app/work/forge.config.mjs) 中：
  - 在 `packagerConfig.extraResource` 数组中添加 `./templates`，确保应用打包后包含该目录。

## 4. 主进程模板读取服务开发

- [ ] 在 [WorkspaceService](file:///Users/liujinglun/code/willow/app/work/src/main/service/workspace.service.ts) 中：
  - 新增 `getTemplatesDir()` 方法以返回开发和生产环境下的模板物理路径。
  - 新增 `getWorkspaceTemplates()` 方法。
  - 实现扫描 `getTemplatesDir()`、解析 `template.json` 逻辑。
  - 实现将图片转换为 base64 data URL 逻辑。
  - 新增方法 `getWorkspaceTemplateById(id: string)` 用于根据 ID 获取模板详情（获取 zip 绝对路径和文件名）。

## 5. 创建工作空间拷贝与 Session 生成逻辑

- [ ] 在 [WorkspaceService](file:///Users/liujinglun/code/willow/app/work/src/main/service/workspace.service.ts) 中：
  - 重载或修改 `createWorkspace` 和 `createDefaultWorkspace`，使其支持 `templateId?: string` 参数。
  - 在物理目录创建完成后，若指定了 `templateId`：
    - 读取模板，使用 `fs.promises.cp` 将模板的 zip 包拷贝至新工作空间的根目录下。
- [ ] 在 [CreateWorkspaceController](file:///Users/liujinglun/code/willow/app/work/src/main/controllers/workspace/create.workspace.controller.ts) 中：
  - 注入 `SessionService`。
  - 接收并处理 `templateId` 属性。
  - 拷贝 zip 成功后，调用 `sessionService.createSession(workspace.id)` 创建初始会话。
  - 返回 `{ workspace, session, zipFileName }`。

## 6. 主进程控制器与模块注册

- [ ] 新建 [get.workspace.templates.controller.ts](file:///Users/liujinglun/code/willow/app/work/src/main/controllers/workspace/get.workspace.templates.controller.ts) 控制器，实现 `GET_WORKSPACE_TEMPLATES` 接口调用。
- [ ] 在 [app.module.ts](file:///Users/liujinglun/code/willow/app/work/src/main/app.module.ts) 中注册新的控制器并完成依赖注入。

## 7. 渲染进程 UI 模板展示设计

- [ ] 升级 [CreateWorkspace.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer/src/layout/dialog/create-workspace/CreateWorkspace.vue)：
  - 组件挂载时拉取模板列表。
  - 在目录选择下方添加“选择模板”的卡片展示网格。
  - 实现卡片选中效果（高亮边框、阴影、可选标记）。
  - 支持“不使用模板”选项（默认）。
  - 在 `handleSubmit` 中将选中的 `templateId` 发送至主进程。

## 8. 渲染进程跳转与自动发送消息逻辑

- [ ] 升级 [CreateWorkspace.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer/src/layout/dialog/create-workspace/CreateWorkspace.vue) 提交流程：
  - 如果接口返回结果中包含 `session` 且有 `zipFileName`：
    - 异步执行刷新：`await workspaceStore.fetchWorkspaceList()` 且 `await sessionStore.fetchSessionList(...)`。
    - 展开当前新工作空间的侧边栏列表。
    - 调用 `router.push(`/${session.id}`)` 导航到新建会话。
    - 导航成功后，延时发送默认解压消息：`electronAPI.sendMessage({ sessionId: session.id, message: "解压「金融管理.zip」包到当前目录" })`（使用所选模板对应的实际 zip 包文件名）。

## 9. 准备内置模板及清理验证

- [ ] 在项目根目录下创建 [app/work/templates/financial-management/](file:///Users/liujinglun/code/willow/app/work/templates/financial-management/) 文件夹：
  - 编写 `template.json` 配置。
  - 放置一张预览图（如 `preview.png`）。
  - 创建一个包含 mock 技能/应用文件的 `金融管理.zip`。
- [ ] 运行 `pnpm lint` 验证无代码规范与类型错误。
- [ ] 本地启动验证模板加载、拷贝、跳转与消息发送功能完备。
