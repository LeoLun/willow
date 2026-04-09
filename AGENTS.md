Always use `docs/ai-workflows/openspec/*.md` as the project source of truth.
Always use the project `workflow-*` workflow for AI collaboration.

## Workflow Contract

- Only use these workflow skills for project process orchestration: `workflow-spec`, `workflow-worktree`, `workflow-plan`, `workflow-implement`, `workflow-close`.
- Do not use legacy `openspec-*` or `superpowers` workflow skill names in this repository.
- All new workflow-side documents must be written under `docs/ai-workflows/`.
- The canonical OpenSpec storage location is `docs/ai-workflows/openspec/`.
- The repository root `openspec/` path is a compatibility symlink for tools that still expect the default OpenSpec directory.
- Standard sequence:
  1. `workflow-spec`: define or update the OpenSpec change.
  2. `workflow-worktree`: prepare an isolated implementation workspace.
  3. `workflow-plan`: write an execution plan to `docs/ai-workflows/plans/`.
  4. `workflow-implement`: implement strictly against OpenSpec and the plan.
  5. `workflow-close`: run final verification, review, and archive when ready.
- If implementation reveals a missing requirement or design conflict, return to `workflow-spec` before continuing code changes.

# Repository Guidelines

## Project Structure & Module Organization

This repository is a `pnpm` workspace with two main areas:

- `packages/poetry/src/`: reusable Electron framework layer (decorators, dependency injection, IPC binding, window/module management).
- `app/work/src/`: desktop app implementation, split by process:
  - `main/`: Electron services and controllers
  - `preload/`: `contextBridge` exposure
  - `renderer/`: Vue 3 UI
  - `shared/`: IPC constants and shared types

Database schema and migrations live in `app/work/src/main/db/`.

## Build, Test, and Development Commands

Install dependencies first:

```bash
pnpm install
```

Key commands:

- `pnpm build`: build all workspace packages.
- `pnpm dev`: run the Electron app (`app/work`) in development mode.
- `pnpm dev:p`: watch-build `packages/poetry` via `tsup --watch`.
- `pnpm lint`: run `oxlint` for `app/` and `packages/`.
- `pnpm format` / `pnpm format:check`: format or check formatting with `oxfmt`.
- `cd app/work && pnpm package`: package desktop app.
- `cd app/work && pnpm make`: generate platform installers.

## Coding Style & Naming Conventions

- Language: TypeScript with `strict` mode enabled.
- Vue SFCs must use `<script setup lang="ts">`.
- Indentation: 2 spaces.
- Imports order: Node built-ins, third-party deps, alias imports, relative imports.
- Prefer double quotes for imports; follow surrounding semicolon style.

Naming:

- Vue components: `PascalCase` (e.g., `ChatInput.vue`)
- Files: `kebab-case` (e.g., `workspace.service.ts`)
- Functions/composables: `camelCase`; composables start with `use`
- Pinia stores: setup-style `defineStore("name", () => {})`
- IPC constants/channels: `UPPER_SNAKE_CASE`

## Testing Guidelines

No formal test runner is currently configured. `packages/poetry` includes Jest as a dev dependency, but no active test script exists; `app/work` also has no test framework wired in yet.

Before submitting changes, run `pnpm lint`, relevant build commands, and verify behavior manually with `pnpm dev`. When adding tests, place them near source files and use `*.test.ts`.

## Commit & Pull Request Guidelines

Use concise Conventional Commit prefixes, consistent with history (e.g., `feat: 添加todo 功能`, `feat: 修改样式`). Prefer Simplified Chinese for user-visible changes.

PRs should include:

- scope summary and impacted packages
- screenshots for renderer/UI updates
- explicit notes for migrations, environment variable changes, or build-impacting changes

## Security & Configuration Tips

- Never commit `.env` files or any secrets.
- Store app tokens only in local `.env`.
- Use `workspace:*` for local package references and `catalog:` for shared dependency versions.
