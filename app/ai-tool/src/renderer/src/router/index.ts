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
        path: '/upload',
        name: 'Upload',
        component: () => import('../views/upload/Upload.vue'),
        meta: { keepAlive: true },
      },
      {
        path: '/rename',
        name: 'AiRename',
        meta: { keepAlive: true },
        component: () => import('../views/rename/AiRename.vue'),
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