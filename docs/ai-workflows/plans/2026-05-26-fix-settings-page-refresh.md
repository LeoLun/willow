# Plan: Fix Settings Page Refresh via Absolute Layout Overlay

## Goal
Avoid page reload and state loss when opening settings and returning back to the main app layout. Make settings an absolute layout overlay covering the main page and freeze the chat layout's route state while settings is open.

## Proposed Changes

### Renderer

#### [MODIFY] [router.ts](file:///Users/liujinglun/code/willow/app/work/src/renderer/src/router.ts)
- Modify the `/setting` route configuration to use named views.
- Set `default: Chat` and `settings: Setting` for the `/setting` route.

#### [MODIFY] [App.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer/src/App.vue)
- Unify the layout structure to keep `SidebarProvider` always mounted.
- Add an absolute-positioned overlay `div` with `z-[200]` and `v-if="isSettingsLayout"` to render `<RouterView name="settings" />`.

#### [MODIFY] [Chat.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer/src/pages/chat/Chat.vue)
- Add active route cache variables (`activeRouteName`, `activeRouteParams`, `activeRouteQuery`).
- Freeze updates to these variables when `route.path` starts with `/setting`.
- Use the cached active route variables in all computed properties and watchers to prevent data re-fetching and re-rendering when navigating to/from settings.

## Verification
- Manual verification: open settings, return, check that chat/sidebar state is preserved and no network/db calls are triggered.
