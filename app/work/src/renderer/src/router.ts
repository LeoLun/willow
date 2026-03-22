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
      { path: "/", component: Workspace },
      { path: "/:sessionId", component: Session },
    ],
  },
  { path: "/skills", component: Skills },
  { path: "/setting", component: Setting },
  { path: "/auto", component: Auto },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
