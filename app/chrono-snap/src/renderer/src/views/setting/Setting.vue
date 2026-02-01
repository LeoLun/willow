<script setup lang=ts>
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  Settings2
} from 'lucide-vue-next'
import {
  Card,
  CardContent
} from '@/components/ui/card'
import BaseSetting from './components/BaseSetting.vue';
import AiSetting from './components/AiSetting.vue';

const nav = [
  {
    title: '基础设置',
    icon: Settings2,
    name: 'Home',
  },
  {
    title: 'AI',
    icon: Sparkles,
    name: 'Flow',
  },
]

const current = ref('Home')

const currentComponent = computed(() => {
  switch (current.value) {
    case 'Home':
      return BaseSetting
    case 'Flow':
      return AiSetting
  }
})

const handleNavClick = (name: string) => {
  current.value = name
}

</script>

<template>
  <div class="flex flex-1 h-screen w-screen overflow-hidden">
    <div class="pt-8 w-36">
      <div class="px-3 py-2 flex flex-col h-full">
        <Button
            v-for="item in nav"
            variant="ghost"
            class="w-full justify-start hover:bg-[hsl(var(--sidebar-accent))] hover:text-primary]"
            :class= "{
              'bg-[hsl(var(--sidebar-accent))]': current === item.name,
              'text-primary': current === item.name
            }"
            @click="handleNavClick(item.name)"
          >
            <component :is="item.icon" />
            <span>{{ item.title }}</span>
        </Button>
      </div>
    </div>
    <div class="flex flex-1 flex-col p-3 pl-0 w-full h-full">
      <Card class="w-full h-full bg-background">
        <CardContent class="p-4">
          <component :is="currentComponent" />
        </CardContent>
      </Card>
    </div>
  </div>
</template>