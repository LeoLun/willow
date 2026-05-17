# Execution Plan: Floating Ball (2026-05-14)

This plan maps the OpenSpec tasks for the `floating-ball` feature to concrete execution steps.

## Phase 1: Infrastructure & IPC

**Objective:** Set up the storage layer and IPC channels for the floating ball.

1. **Dependency:** Install `electron-store` (if not already present or decide to use a simple JSON file alternative; `electron-store` is recommended by design).
2. **State Management:**
   - Create `app/work/src/main/service/floating-ball.service.ts`.
   - Implement `FloatingBallStore` interface (`enabled`, `x`, `y`).
   - Implement read/write methods for configuration.
3. **IPC Contracts:**
   - Update `app/work/src/shared/constants.ts` with channels: `GET_FLOATING_BALL_CONFIG`, `SET_FLOATING_BALL_ENABLED`, `SET_FLOATING_BALL_POSITION`, `SHOW_MAIN_WINDOW`, `SHOW_FLOATING_BALL_MENU`.
   - Update `app/work/src/shared/api.ts` with corresponding request/response payload types.
   - Update `app/work/src/preload/index.ts` to expose these new methods under `window.api`.
4. **Verification:**
   - Types compile successfully (`pnpm tsc --noEmit` or via IDE).
   - `pnpm lint` passes for the touched files.

## Phase 2: Main Process & Window Construction

**Objective:** Build the Electron window wrapper and controller logic.

1. **Window Definition:**
   - Create `app/work/src/main/window/floating-ball.window.ts`.
   - Configure as frameless, transparent, `alwaysOnTop: true`, `skipTaskbar: true`, `resizable: false`, ~60x60 dimensions.
2. **Controller Integration:**
   - Create `app/work/src/main/controllers/floating-ball.controller.ts`.
   - Bind IPC channels to the `FloatingBallService`.
3. **App Registration:**
   - Update `app/work/src/main/app.module.ts` (or equivalent) to provide `FloatingBallWindow`, `FloatingBallService`, and `FloatingBallController`.
4. **Build Configuration:**
   - Modify `app/work/forge.config.mjs` to include a new entry in the `renderer` array named `floating_ball` (reusing `vite.renderer.config.ts`).
5. **Verification:**
   - The main app boots without errors.

## Phase 3: Renderer & Floating Ball UI

**Objective:** Create the standalone Vite renderer for the floating ball itself.

1. **Vite Entry Setup:**
   - Create renderer entry points for the floating ball (e.g., `app/work/src/renderer/src/floating-ball/index.html` and `main.ts`, adjusting path according to how Forge expects it).
2. **Component UI:**
   - Create `app/work/src/renderer/src/floating-ball/FloatingBall.vue`.
   - Add styling: circular button, `border-radius: 50%`, `-webkit-app-region: drag`.
3. **Interactivity:**
   - **Click:** Left-click triggers `SHOW_MAIN_WINDOW` IPC.
   - **Context Menu:** Right-click (`contextmenu` event) triggers `SHOW_FLOATING_BALL_MENU` IPC.
   - **Drag:** Ensure CSS dragging works, and use `BrowserWindow`'s `move` event in the main process (debounced) to update the position store via `FloatingBallService`.
4. **Verification:**
   - Temporarily force the window to open on startup to verify the UI loads and drag behavior works natively.

## Phase 4: Settings Integration & Native Menus

**Objective:** Wire the floating ball to the main app's settings and finalize main-process interactions.

1. **Settings Route & UI:**
   - Create `app/work/src/renderer/src/pages/setting/floating-ball/FloatingBallSetting.vue` containing a Switch/Toggle for enablement.
   - Update router (`router.ts`) with `/setting/floating-ball`.
   - Update the settings sidebar (`Setting.vue`) with a "悬浮球" navigation item.
2. **Context Menu:**
   - In `FloatingBallController` / `FloatingBallService`, handle `SHOW_FLOATING_BALL_MENU` by building a native `Menu` with items: "显示主窗口", "退出登录", "退出 Willow".
   - Implement the logout logic (clear DeepSeek API key, close ball) and main window show logic using `WindowFactoryResolver`.
3. **Verification:**
   - Toggling the setting correctly spawns and destroys the floating ball window.
   - Right-clicking the ball opens the native menu and actions execute correctly.

## Phase 5: Polish & Edge Cases

**Objective:** Ensure robustness and cross-session stability.

1. **Lifecycle Checks:**
   - On app startup (`AppModule.onReady`), check store: if `enabled` is true, spawn the floating ball.
2. **Screen Boundaries:**
   - Implement logic in `FloatingBallWindow` or Service to ensure coordinates fall within the primary display bounds. If the screen size changes and the ball is out of bounds, snap it to the edge.
3. **Verification:**
   - Move ball to edge, restart app, verify it restores position.
   - Full `pnpm lint` and `pnpm build`.
   - Start the built app (`pnpm start` or equivalent) to ensure Forge handles the dual-renderer setup correctly in production mode.

## Next Steps

Proceed to `workflow-implement` to execute this plan.