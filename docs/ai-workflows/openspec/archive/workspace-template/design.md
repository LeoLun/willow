# 设计文档：添加工作空间时支持选择模板

## 架构决策

### 1. 模板目录及打包结构

模板存放在源码仓库的 `app/work/templates` 目录中。当应用打包时，该目录会被作为 `extraResource` 打包至 Electron 的资源目录中。这与 `builtin-skills` 的机制完全一致。

结构组织如下：
```
app/work/
  ├── forge.config.mjs (在 packagerConfig.extraResource 中添加 "./templates")
  └── templates/
        ├── financial-management/ (子文件夹名称作为模板 id)
        │     ├── template.json      (元数据)
        │     ├── preview.png        (预览图)
        │     └── 金融管理.zip        (技能与应用代码包)
        └── project-management/
              ├── template.json
              ├── preview.jpg
              └── 项目管理.zip
```

### 2. 模板路径解析与读取逻辑

主进程在 `WorkspaceService` 中提供 `getTemplatesDir()` 方法用于获取模板的物理目录路径：
```typescript
private getTemplatesDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "templates")
    : join(app.getAppPath(), "templates");
}
```

在 `getWorkspaceTemplates()` 中：
1. 扫描 `getTemplatesDir()` 目录下的所有子目录。
2. 查找并解析每个子目录下的 `template.json`。
3. 如果存在 `previewFileName` 且文件存在，主进程将其读取为 Base64 Data URL (`data:image/png;base64,...`)。
4. 返回包含所有模板完整信息的数组。

这样设计保证了模板资源能够打包部署，无需用户手动初始化，且通过 Base64 Data URL 解决了渲染进程跨域或本地文件协议加载预览图的安全限制。

### 3. 模板元数据配置 (`template.json`) 格式

每个模板子目录下必须包含一个 `template.json` 文件，包含模板的描述信息：
```json
{
  "id": "financial-management",
  "name": "金融管理",
  "description": "提供金融数据的分析和管理模版，内置金融分析 Skill 和应用代码。",
  "zipFileName": "金融管理.zip",
  "previewFileName": "preview.png"
}
```

### 4. 工作空间创建与拷贝逻辑

主进程修改 `CREATE_WORKSPACE` 处理逻辑：
1. 客户端发送 `CreateWorkspaceRequest`，增加可选参数 `templateId`。
2. 收到请求后：
   - 正常创建工作空间（物理目录及数据库记录）。
   - 如果提供了 `templateId`：
     - 从 `getTemplatesDir()` 中找到匹配的模板目录。
     - 获取 `zipFileName` 的绝对路径，使用 `fs.promises.cp` 拷贝至新创建的工作空间根目录。
     - 使用 `SessionService.createSession` 为新工作空间自动创建一个初始 Session。
     - 将该 `session` 随新创建的 `workspace` 以及对应 zip 包的名称 `zipFileName` 一起在 `CreateWorkspaceResponse` 中返回。
   - 如果没有提供 `templateId`，则不进行拷贝与会话创建，保持原有返回格式。

### 5. UI 逻辑与自动消息发送

**创建工作空间弹窗（`CreateWorkspace.vue`）升级：**
- 初始化时调用新 IPC 接口获取可用模板列表。
- 在“项目目录”下方新增“选择模板（可选）”卡片网格区域。
- 如果模板列表为空，则隐藏模板选择区域。
- 模板卡片采用 Workbench 质感，选中后高亮。
- 提供“不使用模板”选项（默认）。

**创建成功后的逻辑处理（渲染进程）：**
- 渲染进程接收到 `CreateWorkspaceResponse`。
- 如果返回对象中包含 `session` 且有 `zipFileName`：
  1. 调用 `workspaceStore.fetchWorkspaceList()` 刷新工作空间列表。
  2. 调用 `sessionStore.fetchSessionList(...)` 刷新会话。
  3. 执行路由跳转至新会话详情页：`router.push(`/${session.id}`)`。
  4. 跳转成功后，自动向该会话发送消息：`解压「${zipFileName}」包到当前目录`。
  5. 展开新工作空间的折叠状态（`workspaceStore.setWorkspaceExpanded`）。
- 如果返回对象不包含 `session`，则执行原有的刷新并展示工作空间欢迎界面的逻辑。

## 接口变更

### 1. Preload 接口定义

在 `shared/api.ts` 中新增以下定义：

```typescript
export interface WorkspaceTemplate {
  id: string;
  name: string;
  description: string;
  zipFileName: string;
  previewUrl?: string; // 转换为 base64 的预览图 url
}

export interface GetWorkspaceTemplatesResponse {
  templates: WorkspaceTemplate[];
}

// 扩展 CreateWorkspaceRequest
export interface CreateWorkspaceRequest {
  name: string;
  path?: string;
  templateId?: string; // 新增字段
}

// 扩展 CreateWorkspaceResponse
export interface CreateWorkspaceResponse {
  workspace: Workspace;
  session?: Session; // 新增可选字段
  zipFileName?: string; // 新增可选字段
}
```

在 `shared/constants.ts` 中新增：
```typescript
export const GET_WORKSPACE_TEMPLATES = "GET_WORKSPACE_TEMPLATES";
```

在 `preload/preload.ts` 的 `ipcObject` 中暴露新 API：
```typescript
getWorkspaceTemplates: async () => {
  const response = (await ipcRenderer.invoke(
    GET_WORKSPACE_TEMPLATES,
  )) as ApiResponse<GetWorkspaceTemplatesResponse>;
  if (response.code !== 0) {
    throw new Error(response.msg);
  }
  return response.data!;
}
```
