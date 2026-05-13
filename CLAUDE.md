# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Willow is a pnpm monorepo for an Electron desktop AI assistant app. The main application (`app/work`) uses a custom DI-based Electron framework (`@willow/poetry`) with decorator-driven IPC, SQLite persistence via Drizzle ORM, and a Vue 3 renderer with shadcn-vue. The shared AI agent tooling lives in `@willow/core`.

See `AGENTS.md` for detailed conventions on coding style, naming, commit guidelines, and the standard workflow sequence. Read `DESIGN.md` before any renderer/UI work.

## Key commands

```bash
pnpm install          # install dependencies (required first)
pnpm dev              # run Electron app in dev mode
pnpm dev:ui           # run isolated UI playground
pnpm dev:p            # watch-build @willow/poetry
pnpm build            # build all workspace packages
pnpm lint             # oxlint on app/ and packages/
pnpm format           # format with oxfmt
pnpm format:check     # check formatting
```

App-specific (from `app/work/`):
```bash
pnpm package          # package the desktop app
pnpm make:mac:arm64   # generate macOS ARM installer
pnpm db:generate      # generate Drizzle migrations
pnpm db:push          # push schema changes directly
```

Pre-commit hook runs `lint-staged` (oxlint + oxfmt) and `tsgo --noEmit` type-check on root and app/work tsconfigs.

## Architecture

### DI framework (`@willow/poetry`)

The Electron main process is bootstrapped via a custom inversion-of-control container built on `inversify`. The entry point (`app/work/src/main/main.ts`) calls `CoreFactory.create(AppModule)`.

`AppModule` is decorated with `@Module({ imports, windows, providers, controllers })`. It declares:
- **windows**: Electron BrowserWindow subclasses (e.g. `MainWindow`)
- **providers**: services registered in the DI container (e.g. `DbService`, `AgentService`, `SessionService`)
- **controllers**: IPC handlers that receive renderer calls

Lifecycle hooks use `@On("ready")`, `@On("before-quit")`, etc. decorators on the module class.

### IPC pattern

Render-to-main communication uses decorator-based IPC binding from `@willow/poetry`. Controllers in `app/work/src/main/controllers/` expose methods decorated with IPC channel decorators. The renderer calls them via `app/work/src/renderer/src/lib/ipc.ts`. Shared types live in `app/work/src/shared/api.ts` and IPC channel constants in `app/work/src/shared/`.

### Data layer

SQLite via `better-sqlite3` + Drizzle ORM. Schema defined in `app/work/src/main/db/schema.ts`. Each service that needs persistence has a corresponding DAO service (e.g. `SessionDao`, `WorkspaceDao`) wrapping Drizzle queries. Migrations are generated with `pnpm db:generate`.

### Agent system

`@willow/core` provides a set of AI-agent tools (bash, read, write, edit, grep, find, ls, webfetch, websearch, todoread, todowrite) with a built-in risk/approval coordinator. The `CoreAgent` class wraps `@mariozechner/pi-agent-core` with system prompt construction, skill loading, and tool registration.

`AgentService` in `app/work/src/main/service/agent.service.ts` orchestrates streaming agent runs, tool approval flow, and context compression. Sessions are managed by `SessionService` with message persistence and context window management.

### Renderer structure

```
app/work/src/renderer/
  renderer.ts              # Vue app entry
  index.css                # THE token source — all CSS variables & theme tokens
  src/
    App.vue                # root layout shell (sidebar + router-view)
    router.ts              # Vue Router routes
    lib/ipc.ts             # typed IPC bridge to main process
    stores/                # Pinia stores (workspace, session, automation, config)
    composables/           # shared composables
    layout/                # sidebar, dialog, and other layout shells
    pages/                 # route-level pages
      chat/workspace/      # workspace home (chat selection)
      chat/session/        # active agent chat session
      auto/                # automation list & detail
      setting/             # appearance & configuration settings
      skills/              # skill management
      workspace-history/   # workspace session history
    components/            # shared app-level components
```

### UI component hierarchy

- `@willow/shadcn` — local shadcn-vue primitives (Button, Dialog, Card, etc.)
- `@willow/ui` — higher-level shared UI (MessageList, tool renderers, code blocks)
- `@willow/sender` — chat input sender component with file/resource picker
- `@willow/editor-md` — markdown editor
- App-specific components in `app/work/src/renderer/src/components/`

Always prefer `@willow/shadcn` and `@willow/ui` before creating new primitives. Icons from `lucide-vue-next`.

### Automation system

Cron-based scheduled agent runs managed by `AutomationSchedulerService`. Automations belong to workspaces, have a trigger (schedule with cron expression), prompt, and model binding. Runs create sessions and stream agent results. The `node-cron` library drives scheduling in the main process.

## Workflow system

All AI-assisted development follows the workflow pipeline defined in `docs/ai-workflows/`:

1. `workflow-spec` → define requirements as OpenSpec artifacts in `docs/ai-workflows/openspec/changes/<change>/`
2. `workflow-worktree` → create isolated git worktree for implementation
3. `workflow-plan` → expand OpenSpec tasks into executable plan at `docs/ai-workflows/plans/YYYY-MM-DD-<change>.md`
4. `workflow-implement` → execute plan step by step with verification
5. `workflow-close` → final review, archive, merge

OpenSpec truth source is `docs/ai-workflows/openspec/` (the root `openspec/` is a symlink for CLI compatibility). Legacy `openspec-*` and `superpowers` workflow names are deprecated.
