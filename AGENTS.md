# AGENTS.md — Willow Monorepo

## Project Overview

Willow 是基于 **pnpm 9 workspace** 的 monorepo，包含以下包：

- `packages/poetry` — Electron 框架库（装饰器、DI、IPC 接线），基于 Inversify + reflect-metadata
- `packages/ai-core` — AI 核心逻辑库，封装模型适配、流式响应、会话管理、Prompt 构建，基于 @mariozechner/pi-ai
- `app/work` — Electron 桌面应用（OpenCode 聊天 UI），使用 Poetry、Vue 3、Pinia、Tailwind CSS 4

## Build / Lint / Test Commands

```bash
# ─── Workspace ───
pnpm install                  # 安装所有依赖
pnpm -r run build             # 构建所有包

# ─── packages/poetry ───
cd packages/poetry
pnpm build                    # tsup → CJS + ESM + .d.ts → dist/
pnpm dev                      # tsup --watch

# ─── packages/ai-core ───
cd packages/ai-core
pnpm build                    # tsup → CJS + ESM + .d.ts → dist/
pnpm dev                      # tsup --watch

# ─── app/work ───
cd app/work
pnpm start                    # electron-forge start (dev mode)
pnpm run package              # electron-forge package
pnpm run make                 # electron-forge make
pnpm run lint                 # eslint --ext .ts,.tsx .
```

### Running a Single Test

尚未配置测试框架。推荐采用 Vitest：

```bash
pnpm vitest run src/path/to/file.test.ts      # 单文件
pnpm vitest run -t "test name pattern"         # 按名称
```

## Tech Stack

| Layer       | Technology                                        |
|-------------|---------------------------------------------------|
| Monorepo    | pnpm workspaces, catalog deps                     |
| Framework   | Electron (Forge), Vue 3.5, Poetry (custom DI)     |
| AI Core     | @mariozechner/pi-ai, @mariozechner/pi-agent-core   |
| State       | Pinia 3 (setup-style stores)                       |
| UI          | shadcn-vue, reka-ui, lucide-vue-next               |
| Styling     | Tailwind CSS 4, tw-animate-css                     |
| Build       | Vite 5, tsup (poetry & ai-core)                    |
| TypeScript  | Strict mode, decorators enabled                    |

## Repository Structure

```
willow/
├── packages/
│   ├── poetry/               # DI 框架
│   │   └── src/
│   │       ├── decorators/       @Injectable, @Module, @Window, @IPC, @On
│   │       ├── core/             CoreFactory, WindowFactoryResolver
│   │       ├── interfaces/       OnInit, OnDestroy hooks
│   │       └── manager/          ModuleManager, WindowManager
│   └── ai-core/              # AI 核心逻辑
│       └── src/
│           ├── adapter/          ModelAdapter, StreamTransformer, TokenGuard
│           ├── models/           模型注册表 (DeepSeek, Qwen), resolveModel
│           ├── prompt/           PromptBuilder (模板变量 + 动态上下文)
│           └── session/          SessionManager, ConversationTree, Serializer
├── app/
│   └── work/                 # Electron 应用
│       └── src/
│           ├── main/             Poetry module, controllers, services
│           ├── preload/          contextBridge IPC exposure
│           ├── renderer/         Vue SPA (components, stores, composables)
│           └── shared/           IPC constants & typed interfaces
└── pnpm-workspace.yaml
```

## Code Style Guidelines

### 语言

- 注释、文档、commit message 统一使用**简体中文**，除非上下文需要英文。

### TypeScript

- 全局 `strict: true`；`app/work` 额外启用 `noImplicitAny`。
- `experimentalDecorators` + `emitDecoratorMetadata`（Poetry DI 必需）。
- `ai-core` 使用 `moduleResolution: "bundler"`，target ES2020。
- 函数参数必须显式标注类型；返回值简单时可推断。
- 类型导入使用 `import type { ... }`。

### Imports

- **双引号**，所有 import 路径统一。
- 顺序：Node 内置 → 外部包 → 本地别名（`@/`, `@main/`, `@shared/`）→ 相对路径。
- `ai-core` 内部相对引用带 `.js` 后缀（如 `"./model-adapter.js"`）。
- 依赖引用：`workspace:*`（本地包），`catalog:`（共享版本）。

### Naming Conventions

| Kind           | Convention   | Example                                 |
|---------------|-------------|------------------------------------------|
| 文件           | kebab-case   | `model-adapter.ts`, `chat-input.vue`     |
| Vue 组件       | PascalCase   | `ChatInput.vue`, `LeftSidebar.vue`       |
| 类             | PascalCase   | `SessionManager`, `TokenGuard`           |
| 函数           | camelCase    | `resolveModel`, `transformStream`        |
| Composables   | `use` 前缀   | `useDarkMode`, `useOpencodeEvents`       |
| Pinia stores  | `use` 前缀   | `useChatStore`, `useInitStore`           |
| 常量           | UPPER_SNAKE  | `MODULE_METADATA`, `OPEN_SETTING`        |
| IPC channels  | UPPER_SNAKE  | `START_AI_STREAM`, `PARSE_BILL_FILE`     |
| 生成 ID 函数   | 前缀格式     | `sess_`, `msg_`, `node_` + timestamp     |

### Vue Components

- 必须使用 `<script setup lang="ts">`（仅 Composition API）。
- 文件顺序：`<script setup>` → `<template>` → `<style scoped>`。
- Props 使用 `defineProps<Props>()` + `withDefaults`；事件使用 `defineEmits`。
- UI 基于 shadcn-vue (reka-ui)；用 `cn()` 合并 class。

### Pinia Stores

- Setup-style：`defineStore("name", () => { ... })`。
- 用 `// ─── 状态 ───` / `// ─── Getters ───` / `// ─── Actions ───` 分区。

### ai-core Patterns

- 类中用 `private` 字段 + public 方法，方法加中文 JSDoc 注释。
- 流式事件类型用 discriminated union：`{ type: "stream:text-delta"; ... }`。
- 所有流式事件必须可 JSON 序列化（适配 Electron IPC）。
- Builder 类方法返回 `this` 支持链式调用（如 `PromptBuilder`）。
- 模型定义集中在 `models/` 目录，按厂商分文件，统一注册到 `ModelRegistry`。
- Token 估算区分 CJK / Latin 字符（CJK ≈ 1.5 字符/token，Latin ≈ 4 字符/token）。
- 用 `// ─── 分区标题 ───` 注释在类型文件和大类中划分逻辑区域。

### Error Handling

- IPC handler 必须 try/catch，失败返回 `{ result: 'error', error: string }`。
- 使用 `e instanceof Error ? e.message : String(e)` 安全提取错误信息。
- 禁止 throw 原始字符串，必须 throw `Error` 对象。
- 错误消息使用中文（如 `throw new Error("会话不存在: ${id}")`）。

### Formatting

- 2 空格缩进，尾随逗号，使用分号。
- 无 Prettier 配置——保持与周围代码一致。

### ESLint

`app/work/.eslintrc.json`：extends `eslint:recommended`, `@typescript-eslint/recommended`, `import/recommended`, `import/electron`。

### Git & Environment

- `.env` 已 gitignore，敏感 token 放 `.env`。
- `pnpm-workspace.yaml` 中用 `catalog:` 管理共享依赖版本。
