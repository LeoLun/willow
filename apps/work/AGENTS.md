# Work App Guidelines

These instructions apply to every file under `apps/work/` and supplement the repository-level `AGENTS.md`.

## Structure and Commands

The Work app is an Electron application. `src/main/` owns the main process, `src/preload/` exposes narrow renderer bridges, `src/renderer/` contains the Vue 3 UI, and `src/shared/` holds cross-process contracts. App artwork lives in `assets/`; app tests live in `test/`.

- `pnpm --filter Willow dev` rebuilds native modules and starts the app through Electron Forge.
- `pnpm --filter Willow lint` runs Oxlint for app source files.
- `pnpm --filter Willow typecheck` runs main/preload TypeScript checks and renderer `vue-tsc` checks.
- `pnpm --filter Willow test` runs the app Vitest suite once.
- `pnpm --filter Willow package` creates an unpacked app; use `make` instead of `package` to build platform installers.

## Main-Process Runtime Assets

- Do not assume files under `assets/` are included in the packaged application. Electron Forge's Vite build can omit assets that are loaded by filesystem path instead of imported into a renderer bundle.
- Resolve main-process runtime assets relative to the compiled main entry, for example `join(__dirname, "../../assets/icons/example.png")`. Do not use source-tree absolute paths or `process.cwd()` at runtime.
- For every asset loaded this way, explicitly copy it in `forge.config.mjs`'s `packageAfterCopy` hook to the same relative location under `buildPath`. A runtime path ending in `assets/icons/example.png` requires the packaged file at `join(buildPath, "assets/icons/example.png")`.
- Copy all required resolution variants together, such as both `name.png` and `name@2x.png`; never rely on the base image causing its Retina companion to be packaged automatically.
- If the asset is required after an ASAR hot update, add its packaged path to `validateAsar` in `src/main/service/app-update.service.ts` and update `test/app-update-asar.test.ts` in the same change.
- Packaging-sensitive changes are not verified by dev mode. Build an unpacked app with `pnpm --filter Willow package:mac` and inspect the generated `app.asar` to confirm every runtime asset exists at the exact path expected by the main process.

## Coding Conventions

Vue files must use Composition API with `<script setup lang="ts">`. Name components in `PascalCase` (`DialogProvider.vue`), composables with a `use` prefix (`useDarkMode.ts`), and services/controllers in kebab-case (`event.service.ts`). Prefer configured aliases such as `@main`, `@shared`, and `@/` over long relative paths.

## Renderer Dialogs

- Open application dialogs through `useDialog` from `@/layout/dialog`; feature components must not construct their own `Dialog`, overlay, or teleport hierarchy.
- Mount exactly one `DialogProvider` at the renderer root. Do not add providers inside pages or feature components.
- Implement each dialog body as a dedicated PascalCase Vue component and pass it to `openDialog(component, props?, options?)`. Dialog bodies may emit `close` when they need to dismiss themselves; the provider owns the actual open state.
- Pass dialog-specific data through `props`. Use `options.contentClass` only for content-specific sizing or layout overrides, not to recreate shared visual styling.
- Keep global dialog visuals in the shared shadcn dialog primitives. Overlay blur, stacking, surface treatment, close-button appearance, animations, and light/dark behavior must apply consistently to every dialog rather than being duplicated at call sites.

```ts
import { useDialog } from "@/layout/dialog";
import SettingDialog from "@/layout/setting/Setting.vue";

const { openDialog } = useDialog();

function openSettingDialog() {
  openDialog(SettingDialog);
}
```

## Main Process Controllers

- Place Electron IPC controllers in `src/main/controllers/`. Group related endpoints in a domain folder and name each file `<action>.<domain>.controller.ts`, for example `credential/get.credential.controller.ts`.
- Every IPC controller must extend `IPCBaseController<Request, Response>`, use `@Injectable()`, and decorate its `run` method with `@IPC(EVENT_CONSTANT)`.
- Define request and response contracts in `src/shared/api.ts` and IPC event names in `src/shared/constants.ts`. Do not duplicate wire types or event strings inside controllers.
- Use constructor injection for services. Validate untrusted IPC input in `checkParams`, return `buildError(400, message)` for invalid requests, call the service only after validation succeeds, and return successful results through `buildResponse`.
- Keep controllers thin: persistence, encryption, and business logic belong in services. Unless an endpoint defines an explicit error mapping, let service errors propagate to the IPC caller instead of swallowing them.
- Register every controller in the `controllers` list in `src/main/app.module.ts`. Adding a main-process handler does not implicitly authorize a preload or renderer API; expose it through `IRenderHook` only when that additional surface is requested.

## Testing and Verification

Vitest runs in a Node environment. Add tests as `test/<feature>.test.ts`, group behavior with `describe`, and keep them deterministic by cleaning temporary files in hooks. Controller tests must cover successful responses, invalid input without service calls, missing data where applicable, service delegation, and propagated failures.

For renderer changes, run the relevant automated checks plus `pnpm --filter Willow dev`, then manually verify the affected Electron flow. Pull requests with renderer changes should include screenshots or recordings. Call out native dependency, packaging, or Electron configuration impacts.

## Security and IPC

Keep cross-process APIs narrow: define shared IPC contracts in `src/shared/` and expose only required functionality through preload. Never log credentials or include credential values in error messages.

For tool approvals, the main process owns and persists the immutable request payload. The renderer
may submit only `approvalId` and `allow/deny`; it must never echo command, workspace/session,
normalized Action, or requested permission scope as authority. Preserve the existing global FIFO
approval composable and pending-approval recovery flow. Human-only (`autoReviewable: false`)
requests must bypass AI review, and unattended sessions must fail closed.
