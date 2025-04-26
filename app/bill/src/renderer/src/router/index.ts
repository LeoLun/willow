import { createWebHistory, createRouter } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { 
    path: '/',
    component: () => import('../views/root/Root.vue'),
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('../views/home/Home.vue'),
      },
      {
        path: '/flow',
        name: 'Flow',
        component: () => import('../views/flow/Flow.vue'),
      },
      {
        path: '/calendar',
        name: 'Calendar',
        component: () => import('../views/calendar/Calendar.vue'),
      },
    ]
  },
  { path: '/setting', component: () => import('../views/setting/Setting.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router