# 任务列表

## 1. 协议与主进程实现
- [ ] 在 `app/work/src/shared/constants.ts` 中添加 `READ_FILE` 常量。
- [ ] 在 `app/work/src/shared/api.ts` 中添加 `ReadFileRequest` 和 `ReadFileResponse` 类型定义。
- [ ] 在 `app/work/src/preload/preload.ts` 中暴露 `readFile` 接口。
- [ ] 在 `app/work/src/main/service/workspace.service.ts` 中添加读取工作空间内文件的逻辑。
- [ ] 创建 `app/work/src/main/controllers/workspace/read.file.controller.ts` 并注册在 IPC 容器中。

## 2. 依赖引入与 Monaco 环境配置
- [ ] 在 `app/work/package.json` 中安装 `monaco-editor`。
- [ ] 配置 Monaco Editor Worker 的打包/运行支持，确保在 Vite 下能正常载入。

## 3. UI 弹窗实现
- [ ] 创建 `app/work/src/renderer/src/layout/dialog/file-viewer` 目录。
- [ ] 编写 `FileViewerDialog.vue` 组件，使用 `monaco-editor` 渲染只读的代码预览。
- [ ] 增加语法高亮语言的自动推断逻辑（根据文件后缀名）。

## 4. 触发逻辑集成
- [ ] 在 `WorkspaceFileTree.vue` 中，为文件行绑定点击事件，使其成为可点击的 Button/Div。
- [ ] 点击时调用 `openDialog` 唤起 `FileViewerDialog`，传入对应的文件路径与文件名。

## 5. 验证与回归测试
- [ ] 运行 `pnpm lint` 和 `pnpm build` 验证构建成功。
- [ ] 手动运行项目，在侧边栏点击多种扩展名的文件，确保高亮和只读机制正常运行。
