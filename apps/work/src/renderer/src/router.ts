import { createWebHistory, createRouter, type RouteRecordRaw } from "vue-router";

import Auto from "./pages/main/auto/Auto.vue";
import Chat from "./pages/main/chat/Chat.vue";
import ChatBase from "./pages/main/ChatBase.vue";
import Home from "./pages/main/home/Home.vue";
import Main from "./pages/main/Main.vue";

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
    ],
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
