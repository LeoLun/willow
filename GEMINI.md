# Willow Project Context

Willow is a desktop workbench application built with Electron and Vue 3. It utilizes a custom monorepo structure and an AI-driven development workflow called OpenSpec.

## Project Overview

- **Purpose**: A desktop workbench designed for focused task execution and AI collaboration.
- **Architecture**:
  - **Monorepo**: Managed with `pnpm`.
  - **Core Framework**: Custom decorator-based DI and module system (`@willow/poetry`) used in the Electron main process.
  - **Main Application**: `app/work` (Electron + Vue 3).
  - **UI Libraries**: Localized `shadcn-vue` primitives in `packages/shadcn` and business components in `packages/ui`.
- **Primary Tech Stack**:
  - **Frontend**: Vue 3 (Composition API, `<script setup>`), Vite, Tailwind CSS v4, Pinia, Vue Router, shadcn-vue.
  - **Main Process**: Electron, TypeScript, Drizzle ORM, better-sqlite3.
  - **Tooling**: oxlint (linting), oxfmt (formatting), Husky (git hooks).

## Building and Running

### Root Commands

- `pnpm dev`: Starts the main Electron application (`app/work`).
- `pnpm dev:ui`: Starts the UI Playground (`app/ui-playground`).
- `pnpm build`: Builds all packages and applications.
- `pnpm lint`: Runs `oxlint` across the workspace.
- `pnpm format`: Runs `oxfmt` to format the code.

### Main App (`app/work`) Commands

- `pnpm run db:generate`: Generates Drizzle migrations.
- `pnpm run db:push`: Pushes schema changes to the SQLite database.
- `pnpm run rebuild:native`: Rebuilds native modules (e.g., `better-sqlite3`) for Electron.

## AI Development Workflow (OpenSpec)

Willow follows a strict AI-driven development process defined in `docs/ai-workflows/`.

- **Source of Truth**: All requirements, specs, and tasks reside in `docs/ai-workflows/openspec/`.
- **Workflow Stages**:
  1. `workflow-spec`: Refine requirements and update OpenSpec.
  2. `workflow-worktree`: Prepare an isolated git worktree for implementation.
  3. `workflow-plan`: Break down tasks into an execution plan (`docs/ai-workflows/plans/`).
  4. `workflow-implement`: Execute the implementation and verification.
  5. `workflow-close`: Final review and archival.

## Development Conventions

- **Design Philosophy**: Follows `DESIGN.md`. "Desktop workbench" style—calm, focused, and tool-like. Avoid marketing-style visuals.
- **Component Usage**:
  - Always use `shadcn-vue` components from `@willow/shadcn`.
  - Icons: Use `lucide-vue-next`.
- **Code Style**:
  - Vue: Use Composition API with `<script setup lang="ts">`.
  - Main Process: Adhere to the Controller/Service/Module pattern provided by `@willow/poetry`.
- **Naming**:
  - OpenSpec changes: `kebab-case`.
  - Workflow documents: `YYYY-MM-DD-<topic>.md`.
- **Testing**: Verification results must be recorded during the `workflow-implement` phase.

## Key Files

- `DESIGN.md`: Visual and UI/UX guidelines.
- `docs/ai-workflows/conventions.md`: Detailed development and workflow rules.
- `app/work/package.json`: Main application dependencies and scripts.
- `pnpm-workspace.yaml`: Monorepo structure definition.
- `ui/work.pen`: Master design file (accessible via the `pencil` tool).
