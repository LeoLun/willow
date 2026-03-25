# AGENTS.md — Willow Monorepo

## Project Overview

Willow is a **pnpm workspace monorepo** containing:

- `packages/poetry` — Electron framework library (decorators, DI, IPC wiring) built on Inversify + reflect-metadata
- `app/work` — Electron desktop app (OpenCode chat UI) using Poetry, Vue 3, Pinia, Tailwind CSS 4

Package manager: **pnpm 9** (see `packageManager` in root `package.json`).

## Build / Lint / Test Commands

### Workspace-level

```bash
pnpm install              # Install all dependencies
pnpm -r run build         # Build all packages (or: pnpm build)
```

### packages/poetry

```bash
cd packages/poetry
pnpm build                # tsup → CJS + ESM + .d.ts into dist/
pnpm dev                  # tsup --watch
```

No test runner is configured yet (Jest is in devDependencies but has no config or test script).

### app/work

```bash
cd app/work
pnpm start                # electron-forge start (dev mode)
pnpm run package          # electron-forge package
pnpm run make             # electron-forge make (platform installers)
pnpm run lint             # oxlint src/
```

No test runner is configured for app/work.

### Running a Single Test (future reference)

If Vitest is adopted (recommended for this stack):

```bash
pnpm vitest run src/path/to/file.test.ts          # single file
pnpm vitest run -t "test name pattern"             # by name
```

If Jest is used (poetry currently lists jest):

```bash
pnpm jest -- --testPathPattern="file.test.ts"
```

## Tech Stack

| Layer      | Technology                                    |
| ---------- | --------------------------------------------- |
| Monorepo   | pnpm workspaces, catalog deps                 |
| Framework  | Electron (Forge), Vue 3.5, Poetry (custom DI) |
| State      | Pinia 3 (setup-style stores)                  |
| UI         | shadcn-vue, reka-ui, lucide-vue-next          |
| Styling    | Tailwind CSS 4, tw-animate-css                |
| Build      | Vite 5, tsup (poetry)                         |
| AI/Chat    | @opencode-ai/sdk                              |
| TypeScript | Strict mode, decorators enabled               |

## Repository Structure

```
willow/
├── packages/
│   └── poetry/           # DI framework (decorators, core, interfaces)
│       └── src/
│           ├── decorators/    @Injectable, @Module, @Window, @IPC, @On
│           ├── core/          CoreFactory, WindowFactoryResolver
│           ├── interfaces/    OnInit, OnDestroy hooks
│           └── manager/       ModuleManager, WindowManager
├── app/
│   └── work/             # Electron app
│       └── src/
│           ├── main/          main process (Poetry module, controllers, services)
│           ├── preload/       contextBridge IPC exposure
│           ├── renderer/      Vue SPA (components, stores, composables)
│           └── shared/        IPC constants & typed interfaces
└── pnpm-workspace.yaml
```

## Code Style Guidelines

### Language & Response

- All user-facing comments, docs, and commit messages should be in **Simplified Chinese** unless the context requires English.

### TypeScript

- `strict: true` everywhere.
- `experimentalDecorators` and `emitDecoratorMetadata` enabled (required by Poetry DI).
- `noImplicitAny: true` in app/work.
- Prefer explicit types for function parameters; return types may be inferred for simple functions.
- Use `type` imports (`import type { ... }`) for type-only imports.

### Imports

- **Double quotes** for all import paths.
- Order: (1) Node built-ins → (2) External packages → (3) Local aliases (`@/`, `@main/`, `@shared/`) → (4) Relative paths.
- Path aliases in app/work: `@/` → renderer src, `@main/` → main, `@renderer/` → renderer, `@shared/` → shared.
- Use `workspace:*` for local package references; use `catalog:` for shared dependency versions.

### Naming Conventions

| Kind           | Convention   | Example                              |
| -------------- | ------------ | ------------------------------------ |
| Files          | kebab-case   | `core-factory.ts`, `chat-input.vue`  |
| Vue components | PascalCase   | `ChatInput.vue`, `LeftSidebar.vue`   |
| Classes        | PascalCase   | `WorkspaceService`, `InitController` |
| Functions      | camelCase    | `createChatAI`, `selectDirectory`    |
| Composables    | `use` prefix | `useDarkMode`, `useOpencodeEvents`   |
| Pinia stores   | `use` prefix | `useChatStore`, `useInitStore`       |
| Constants      | UPPER_SNAKE  | `MODULE_METADATA`, `OPEN_SETTING`    |
| IPC channels   | UPPER_SNAKE  | `START_AI_STREAM`, `PARSE_BILL_FILE` |

### Vue Components

- **Always** use `<script setup lang="ts">` (Composition API only, no Options API).
- Component order: `<script setup>` → `<template>` → `<style scoped>`.
- Use `defineProps<Props>()` with `withDefaults` for typed props.
- Use `defineEmits` for typed events.
- UI primitives come from shadcn-vue (reka-ui based); use `cn()` utility for class merging.

### Pinia Stores

- Use **setup-style** stores: `defineStore("name", () => { ... })`.
- Organize with section comments: `// ─── 状态 ───`, `// ─── Getters ───`, `// ─── Actions ───`.
- Return explicit object with state, getters, and actions.

### Poetry (DI Framework)

- Decorate injectable services with `@Injectable()`.
- Define app modules with `@Module({ windows, providers, controllers })`.
- Register IPC handlers with `@IPC(CHANNEL_NAME)`.
- Register Electron app events with `@On("ready")`, `@On("activate")`, etc.
- Use `@Window()` for BrowserWindow subclasses; `@WindowInstance()` to inject the raw BrowserWindow.

### CSS / Styling

- Tailwind CSS 4 utility classes (via `@tailwindcss/postcss`).
- Theme via CSS custom properties defined in `renderer/index.css`.
- Use `cn()` (from `@/lib/utils`) to merge conditional classes.

### Error Handling

- Wrap IPC handlers in try/catch; return `{ result: 'error', error: string }` on failure.
- Use `e instanceof Error ? e.message : String(e)` for safe error extraction.
- Do not throw raw strings; always throw `Error` objects.

### Formatting

- 2-space indentation.
- Trailing commas in multi-line arrays/objects.
- No semicolons is acceptable if consistent within a file; the codebase currently uses semicolons.
- No Prettier config exists — maintain consistency with surrounding code.

### Oxlint

Oxlint 配置在根目录 `.oxlintrc.json`：

- 启用插件: `typescript`, `import`
- 分类: `correctness` 级别为 `error`
- 运行: `pnpm lint` 或 `npx oxlint`

### Git & Environment

- Never commit `.env` files (they are gitignored).
- Sensitive tokens (Notion, API keys) go in `.env` at the app level.
- Use `catalog:` in pnpm-workspace.yaml for shared dependency versions across packages.
