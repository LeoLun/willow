import {
  createWebHistory,
  createRouter,
  type RouteRecordRaw,
} from "vue-router";

import Main from "./pages/main/Main.vue";
import Home from "./pages/main/home/Home.vue";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: Main,
    children: [{ path: "/", name: "home", component: Home }],
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
