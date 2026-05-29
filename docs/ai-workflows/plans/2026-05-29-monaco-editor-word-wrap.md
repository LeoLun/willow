# Execution Plan: Monaco Editor 自动折行与禁用横向滚动条

根据已制定的 OpenSpec 设计规范，本计划旨在指导在内联文件预览器中实现 Monaco Editor 的自动折行，并禁用横向滚动条。

## 1. 目标与范围

- 修改目标文件：[InlineFileViewer.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer/src/pages/chat/session/components/InlineFileViewer.vue)
- 修改内容：
  - 更新 Monaco Editor 实例化参数，启用自动换行，隐藏横向滚动条。
- 最终效果：超长文本行能根据容器宽度折行展示，不出现横向滚动条且不支持横向滚动。

## 2. 详细执行步骤

### 步骤 1：修改 Monaco Editor 配置选项
- 打开 [InlineFileViewer.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer/src/pages/chat/session/components/InlineFileViewer.vue)。
- 找到 `monaco.editor.create` 方法的配置项对象。
- 进行以下更新：
  - 将 `wordWrap: "off"` 变更为 `wordWrap: "on"`。
  - 新增 `scrollbar` 对象并设置 `horizontal: "hidden"`。

### 步骤 2：代码质量与风格校验
- 在根目录运行以下命令进行 lint 检查：
  ```bash
  pnpm lint
  ```
- 确认没有由于此次修改导致的 Vue/TS 编译错误或代码风格错误。

### 步骤 3：构建校验
- 运行打包命令以确认代码能够在构建环境中通过：
  ```bash
  pnpm build
  ```
- 确认构建输出正常，无 Monaco 打包配置或打包脚本报错。

### 步骤 4：本地手动验证 (Manual Verification)
- 运行开发环境服务：
  ```bash
  pnpm dev
  ```
- 验证路径：
  1. 打开应用，定位至会话视图。
  2. 选中一个具有超长文本单行的文件。
  3. 确认原本长行超出屏幕的部分在边缘处被自动折回到下一行展示。
  4. 检查编辑器下方，确认没有横向滚动条，且使用鼠标/触控板无法左右滚动内容。

## 3. 依赖项与前置条件

- 本次变更无外部依赖，也无需修改主进程或协议层，直接在 renderer 的 Vue 组件内进行即可。

## 4. 终止与回滚条件

- 若启用 `wordWrap: "on"` 导致编辑器卡顿（针对非常大的文件，如数万行单行超长的情况），则应考虑限制自动折行功能只在文件行数/大小低于一定阈值时启用，或增加“切换折行”的手动按钮。
- 若修改引发其他依赖 Monaco 的文件加载失败，需及时回滚配置。

---
下一步：运行 `workflow-implement` 阶段，在隔离的分支/工作树中执行上述步骤。
