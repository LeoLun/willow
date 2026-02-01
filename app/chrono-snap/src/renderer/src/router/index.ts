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
        path: '/chat/:sessionId',
        name: 'Chat',
        component: () => import('../views/chat/Chat.vue'),
      },
      {
        path: '/upload',
        name: 'Upload',
        component: () => import('../views/upload/Upload.vue'),
      },
    ]
  },
  { path: '/setting', component: () => import('../views/setting/Setting.vue') },
  { path: '/dialog', component: () => import('../views/dialog/Dialog.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router