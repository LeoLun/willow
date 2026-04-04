# Repository Guidelines

## 项目结构与模块组织
该仓库是一个 pnpm workspace，主要包含两部分。`packages/poetry/src/` 是可复用的 Electron 框架层，负责装饰器、依赖注入、IPC 绑定以及窗口和模块管理。`app/work/src/` 是桌面应用本体，按进程拆分：`main/` 放 Electron 服务与控制器，`preload/` 放 `contextBridge` 暴露逻辑，`renderer/` 放 Vue 3 界面，`shared/` 放 IPC 常量与共享类型。数据库 Schema 与迁移文件位于 `app/work/src/main/db/`。

## 构建、测试与开发命令
先执行 `pnpm install` 安装依赖。

- `pnpm build`：构建整个 workspace。
- `pnpm dev`：以开发模式启动 `app/work` Electron 应用。
- `pnpm dev:p`：以 `tsup --watch` 监听 `packages/poetry`。
- `pnpm lint`：对 `app/` 和 `packages/` 运行 `oxlint`。
- `pnpm format` / `pnpm format:check`：使用 `oxfmt` 格式化或检查格式。
- `cd app/work && pnpm package`：打包桌面应用。
- `cd app/work && pnpm make`：生成平台安装包。

## 编码风格与命名规范
使用开启 `strict` 的 TypeScript，并为函数参数提供明确类型。Vue 文件必须使用 `<script setup lang="ts">`。导入语句优先使用双引号，顺序为：Node 内置模块、第三方依赖、别名导入、相对路径。统一使用 2 空格缩进，分号风格保持与周边代码一致。

命名约定：
- Vue 组件：`PascalCase`，例如 `ChatInput.vue`
- 文件名：`kebab-case`，例如 `workspace.service.ts`
- 函数与组合式函数：`camelCase`，组合式函数以 `use` 开头
- Pinia Store：使用 setup 风格 `defineStore("name", () => {})`
- IPC 通道与常量：`UPPER_SNAKE_CASE`

## 测试指南
当前仓库尚未正式配置测试运行器。`packages/poetry` 的开发依赖中包含 Jest，但没有测试脚本；`app/work` 也尚未接入测试框架。在新增测试体系前，请至少运行 `pnpm lint`、相关包构建命令，并通过 `pnpm dev` 进行针对性手动验证。后续若补充测试，建议将测试文件与源码相邻放置，命名为 `*.test.ts`。

## 提交与 Pull Request 规范
最近的提交历史采用简短的 Conventional Commit 前缀，例如 `feat: 添加todo 功能`、`feat: 修改样式`。请沿用这一格式，提交信息保持简洁，并优先使用简体中文描述用户可感知的改动。Pull Request 应说明变更范围，列出受影响的包；若涉及 renderer 界面改动，应附上截图；若包含迁移、环境变量或构建变化，也应明确说明。

## 安全与配置提示
不要提交 `.env` 文件或任何密钥。应用级令牌仅应保存在本地 `.env` 中。引用本地包时使用 `workspace:*`，共享依赖版本使用 `catalog:`。
