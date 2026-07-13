# Repository Guidelines

## Project Structure & Module Organization

Willow is a pnpm workspace. `apps/work/` contains the Electron desktop app: `src/main/` owns the main process, `src/preload/` exposes bridges, `src/renderer/` contains the Vue 3 UI, and `src/shared/` holds cross-process contracts. App artwork lives in `apps/work/assets/`. Under `packages/`, `core` provides agent/session logic, `poetry` provides Electron decorators and managers, and `shadcn` provides reusable Vue components. Core tests live in `packages/core/test/`; supporting material lives in `docs/`.

## Build, Test, and Development Commands

- `pnpm install --frozen-lockfile` installs locked dependencies; use plain `pnpm install` when updating the lockfile.
- `pnpm dev` rebuilds native modules and starts the Electron app through Forge.
- `pnpm lint` runs Oxlint across `apps/` and `packages/`.
- `pnpm typecheck` runs each workspace package's TypeScript or `vue-tsc` checks.
- `pnpm format` formats supported files with Oxfmt; `pnpm format:check` verifies formatting without writing.
- `pnpm --filter @willow/core test` runs the Vitest suite once.
- `pnpm --filter ./apps/work package` creates an unpacked app; replace `package` with `make` to build platform installers.

## Coding Style & Naming Conventions

Write strict TypeScript and ESM. Oxfmt enforces 2-space indentation, 100-column lines, double quotes, semicolons, trailing commas, and sorted imports. Vue files should use Composition API with `<script setup lang="ts">`. Name components in `PascalCase` (`DialogProvider.vue`), composables with a `use` prefix (`useDarkMode.ts`), and services/controllers in kebab-case (`event.service.ts`). Prefer workspace imports such as `@willow/core` and configured aliases such as `@/` over long relative paths.

## Testing Guidelines

Vitest runs in a Node environment for `packages/core`. Add tests as `packages/core/test/<feature>.test.ts`, group behavior with `describe`, and keep tests deterministic by cleaning temporary files in hooks. No coverage threshold is configured; cover new branches and regressions meaningfully. For renderer changes, also run `pnpm dev` and manually verify the affected Electron flow.

## Commit & Pull Request Guidelines

History follows concise Conventional Commit prefixes such as `feat:`, `fix:`, `refactor:`, and `chore:`; summaries may be English or Simplified Chinese. Keep each commit focused. Pull requests should describe the change, list affected workspaces, link relevant issues, and report lint, typecheck, and test results. Include screenshots or recordings for renderer changes and call out native dependency, packaging, or configuration impacts.

## Security & Configuration

Never commit credentials or local `.env` files. Keep cross-process APIs narrow: define shared IPC contracts in `apps/work/src/shared/` and expose only required functionality through preload.

<!-- CODEGRAPH_START -->

## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.

<!-- CODEGRAPH_END -->
