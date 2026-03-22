import {
  createWebHistory,
  createRouter,
  type RouteRecordRaw,
} from "vue-router";

import Chat from "./pages/chat/Chat.vue";
import Setting from "./pages/setting/Setting.vue";
import Auto from "./pages/auto/Auto.vue";
import Session from "./pages/chat/session/Session.vue";
import Workspace from "./pages/chat/workspace/Workspace.vue";
import Skills from "./pages/skills/Skills.vue";

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
  { path: "/skills", name: "skills", component: Skills },
  { path: "/setting", name: "setting", component: Setting },
  { path: "/auto", name: "auto", component: Auto },
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
