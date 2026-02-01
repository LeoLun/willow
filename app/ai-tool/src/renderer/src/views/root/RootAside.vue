<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import {
  FileUp,
  Settings2,
  Sun,
  Moon,
  Home,
  PenLine
} from 'lucide-vue-next'
import { electronAPI } from '@/lib/ipc'
import { useColorMode } from '@vueuse/core'

const router = useRouter()
const route = useRoute()
const mode = useColorMode()

const nav = [
  {
    title: '首页',
    icon: Home,
    name: 'Home',
  },
  {
    title: '上传账单',
    icon: FileUp,
    name: 'Upload',
  },
  {
    title: 'AI 重命名',
    icon: PenLine,
    name: 'AiRename',
  },
]

const active = computed(() => {
  return route.name
})

const handleNavClick = (name: string) => {
  router.push({ name })
}

const handleSettingClick = () => {
  electronAPI.openSettingWindow({ result: 'success' })
}

const handleChangeThemeClick = () => {
  mode.value = mode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <div class="pt-8 shrink-0 max-w-[220px]">
    <div class="px-3 py-2 flex flex-col h-full">
      <h2 class="mb-2 px-4 text-lg font-semibold tracking-tight">
        Willow Tool
      </h2>
      <div class="space-y-1">
        <Button
          v-for="item in nav"
          variant="ghost"
          class="w-full justify-start hover:bg-[hsl(var(--sidebar-accent))] hover:text-primary]"
          :class= "{
            'bg-[hsl(var(--sidebar-accent))]': active === item.name,
            'text-primary': active === item.name
          }"
          @click="handleNavClick(item.name)"
        >
          <component :is="item.icon" />
          <span>{{ item.title }}</span>
        </Button>
      </div>
      <div class="mt-auto">
        <Button variant="outline" size="icon" @click="handleSettingClick">
          <Settings2 class="w-4 h-4" />
        </Button>

        <Button variant="outline" size="icon" @click="handleChangeThemeClick">
          <Sun v-if="mode === 'light'" class="w-4 h-4" />
          <Moon v-if="mode === 'dark'" class="w-4 h-4" />
        </Button>
      </div>
    </div>
  </div>
</template>