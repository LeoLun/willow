# Willow AGENTS.md

For renderer, `shadcn-vue`, and page design work, always consult the repository root `DESIGN.md` after reading the relevant OpenSpec artifacts.

## Workflow Contract

- Only use these workflow skills for project process orchestration: `workflow-spec`, `workflow-worktree`, `workflow-plan`, `workflow-implement`, `workflow-close`.
- Do not use legacy `openspec-*` or `superpowers` workflow skill names in this repository.
- All new workflow-side documents must be written under `docs/ai-workflows/`.
- The canonical OpenSpec storage location is `docs/ai-workflows/openspec/`.
- The repository root `DESIGN.md` is the long-lived renderer design standard. It does not replace feature-level OpenSpec behavior or requirements.
- The repository root `openspec/` path is a compatibility symlink for tools that still expect the default OpenSpec directory.
- Standard sequence:
  1. `workflow-spec`: define or update the OpenSpec change.
  2. `workflow-worktree`: prepare an isolated implementation workspace.
  3. `workflow-plan`: write an execution plan to `docs/ai-workflows/plans/`.
  4. `workflow-implement`: implement strictly against OpenSpec and the plan.
  5. `workflow-close`: run final verification, review, and archive when ready.
- If implementation reveals a missing requirement or design conflict, return to `workflow-spec` before continuing code changes.

## Repository Guidelines

### Project Structure And Module Organization

This repository is a `pnpm` workspace with app packages and shared packages:

- `app/work/`: Electron desktop app.
- `app/ui-playground/`: isolated Vite playground for renderer and UI experiments.
- `packages/core/src/`: shared business/domain utilities published as `@willow/core`.
- `packages/poetry/src/`: reusable Electron framework layer (decorators, dependency injection, IPC binding, window/module management).
- `packages/shadcn/src/`: local `shadcn-vue` component package published as `@willow/shadcn`.
- `packages/ui/src/`: shared higher-level UI package published as `@willow/ui`.

Inside `app/work/src/`, code is split by process:

- `main/`: Electron services, controllers, database access, and app bootstrap.
- `preload/`: `contextBridge` exposure.
- `renderer/`: desktop app shell entry and Vue renderer assets.
- `shared/`: IPC constants, hooks, and shared types.

Database schema and migrations live in `app/work/src/main/db/`.

### Build, Test, And Development Commands

Install dependencies first:

```bash
pnpm install
```

Key workspace commands:

- `pnpm build`: build all workspace packages.
- `pnpm dev`: run the Electron app in development mode (`app/work`).
- `pnpm dev:ui`: run the UI playground (`app/ui-playground`).
- `pnpm dev:p`: watch-build `packages/poetry`.
- `pnpm lint`: run `oxlint` for `app/` and `packages/`.
- `pnpm format`: format with `oxfmt`.
- `pnpm format:check`: check formatting with `oxfmt --check`.

App-specific commands:

- `cd app/work && pnpm package`: package the desktop app.
- `cd app/work && pnpm make`: generate platform installers.
- `cd app/work && pnpm lint`: lint only the Electron app sources.
- `cd app/work && pnpm db:generate`: generate Drizzle migrations.
- `cd app/work && pnpm db:push`: push schema changes.

### Coding Style And Naming Conventions

- Language: TypeScript with `strict` mode enabled.
- Vue SFCs must use `<script setup lang="ts">`.
- Prefer Composition API and setup-style stores for Vue and Pinia code.
- Indentation: 2 spaces.
- Imports order: Node built-ins, third-party deps, alias imports, relative imports.
- Prefer double quotes for imports; follow surrounding semicolon style.

Naming:

- Vue components: `PascalCase` (for example `ChatInput.vue`)
- Files: `kebab-case` (for example `workspace.service.ts`)
- Functions and composables: `camelCase`; composables start with `use`
- Pinia stores: setup-style `defineStore("name", () => {})`
- IPC constants and channels: `UPPER_SNAKE_CASE`

### UI And Renderer Notes

- Treat `app/work` renderer as a desktop productivity surface, not a marketing page.
- Reuse the existing token system from `app/work/src/renderer/index.css`; do not invent a parallel theme layer.
- Prefer `@willow/shadcn` and `@willow/ui` before creating one-off UI primitives.
- Use `app/ui-playground` to validate new renderer patterns or shared UI changes when a fast isolated preview helps.
- For `shadcn-vue` usage or page design updates, read the relevant OpenSpec artifacts first, then `DESIGN.md`.

### Testing Guidelines

There is no formal repository-wide test runner configured yet.

- `packages/poetry` includes Jest as a dev dependency, but no active root test script is wired up.
- `app/work` currently relies on linting, build validation, and manual verification.
- When adding tests, place them near source files and use `*.test.ts`.

Before submitting changes, run the relevant checks for the area you touched:

- `pnpm lint`
- `pnpm build` when the change can affect package build output
- manual verification with `pnpm dev` or `pnpm dev:ui` for renderer/UI work

### Commit And Pull Request Guidelines

- Use concise Conventional Commit prefixes consistent with history.
- Prefer Simplified Chinese for user-visible changes and commit summaries when it matches existing history.

PRs should include:

- scope summary and impacted packages
- screenshots for renderer or UI updates
- explicit notes for migrations, environment variable changes, or build-impacting changes

### Security And Configuration Tips

- Never commit `.env` files or any secrets.
- Store app tokens only in local `.env`.
- Use `workspace:*` for local package references and `catalog:` for shared dependency versions.
