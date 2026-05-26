import { createWebHistory, createRouter, type RouteRecordRaw } from "vue-router";

import Auto from "./pages/auto/Auto.vue";
import AutomationDetail from "./pages/auto/detail/AutomationDetail.vue";
import Chat from "./pages/chat/Chat.vue";
import Session from "./pages/chat/session/Session.vue";
import Workspace from "./pages/chat/workspace/Workspace.vue";
import AboutSetting from "./pages/setting/about/AboutSetting.vue";
import AppearanceSetting from "./pages/setting/appearance/AppearanceSetting.vue";
import ConfigurationSetting from "./pages/setting/configuration/ConfigurationSetting.vue";
import Setting from "./pages/setting/Setting.vue";
import WorkspaceHistory from "./pages/workspace-history/WorkspaceHistory.vue";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: Chat,
    children: [
      { path: "/", name: "workspace", component: Workspace },
      { path: "/conversation", name: "conversation", component: Session },
      { path: "/:sessionId", name: "session", component: Session },
    ],
  },
  {
    path: "/workspace/:workspaceId/history",
    name: "workspaceHistory",
    component: WorkspaceHistory,
  },
  {
    path: "/setting",
    components: {
      default: Chat,
      settings: Setting,
    },
    redirect: "/setting/appearance",
    meta: { layout: "settings" },
    children: [
      { path: "appearance", name: "settingAppearance", component: AppearanceSetting },
      { path: "configuration", name: "settingConfiguration", component: ConfigurationSetting },
      { path: "about", name: "settingAbout", component: AboutSetting },
    ],
  },
  { path: "/auto", name: "auto", component: Auto },
  {
    path: "/auto/:automationId",
    name: "automationDetail",
    component: AutomationDetail,
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  if (to.matched.length === 0 || (to.path === "/" && !to.query.workspaceId)) {
    return { path: "/conversation" };
  }
});
