import { createWebHistory, createRouter, type RouteRecordRaw } from "vue-router";

import Auto from "./pages/auto/Auto.vue";
import AutomationDetail from "./pages/auto/detail/AutomationDetail.vue";
import Chat from "./pages/chat/Chat.vue";
import Session from "./pages/chat/session/Session.vue";
import Workspace from "./pages/chat/workspace/Workspace.vue";
import Setting from "./pages/setting/Setting.vue";
import Skills from "./pages/skills/Skills.vue";
import WorkspaceHistory from "./pages/workspace-history/WorkspaceHistory.vue";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: Chat,
    redirect: "/",
    children: [
      { path: "/", name: "workspace", component: Workspace },
      { path: "/:sessionId", name: "session", component: Session },
    ],
  },
  {
    path: "/workspace/:workspaceId/history",
    name: "workspaceHistory",
    component: WorkspaceHistory,
  },
  { path: "/skills", name: "skills", component: Skills },
  { path: "/setting", name: "setting", component: Setting },
  { path: "/auto", name: "auto", component: Auto },
  { path: "/auto/:automationId", name: "automationDetail", component: AutomationDetail },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  if (to.path === "/" && !to.query.workspaceId) {
    const { useWorkspaceStore } = await import("./stores/workspace");
    const workspaceStore = useWorkspaceStore();
    const list =
      workspaceStore.workspaceList.length > 0
        ? workspaceStore.workspaceList
        : await workspaceStore.fetchWorkspaceList();
    if (list.length > 0) {
      return { path: "/", query: { workspaceId: String(list[0].id) } };
    }
  }
});
