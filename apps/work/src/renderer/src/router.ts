import {
  createRouter,
  createWebHashHistory,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";

import Auto from "./pages/main/auto/Auto.vue";
import Chat from "./pages/main/chat/Chat.vue";
import ChatBase from "./pages/main/ChatBase.vue";
import Home from "./pages/main/home/Home.vue";
import Main from "./pages/main/Main.vue";
import Skill from "./pages/main/skill/Skill.vue";
import { getRendererHistoryMode } from "./router-history";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: Main,
    children: [
      {
        path: "/",
        component: ChatBase,
        children: [
          { path: "/", name: "home", component: Home },
          { path: "/chat/:sessionId", name: "chat", component: Chat },
        ],
      },
      { path: "/auto", name: "auto", component: Auto },
      { path: "/skill", name: "skill", component: Skill },
    ],
  },
];

const history =
  getRendererHistoryMode(window.location.protocol) === "hash"
    ? createWebHashHistory()
    : createWebHistory();

export const router = createRouter({
  history,
  routes,
});
