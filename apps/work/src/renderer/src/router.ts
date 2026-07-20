import { createWebHistory, createRouter, type RouteRecordRaw } from "vue-router";

import Chat from "./pages/main/chat/Chat.vue";
import Home from "./pages/main/home/Home.vue";
import Main from "./pages/main/Main.vue";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: Main,
    children: [
      { path: "/", name: "home", component: Home },
      { path: "/chat/:sessionId", name: "chat", component: Chat },
    ],
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
