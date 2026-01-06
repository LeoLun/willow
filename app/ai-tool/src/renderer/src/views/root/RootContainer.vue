<script setup lang="ts">
import {
  Card,
  CardContent
} from '@/components/ui/card'
</script>
<template>
  <div class="flex flex-1 flex-col p-4 pl-0 w-full h-full overflow-hidden">
    <Card class="w-full h-full bg-background">
      <CardContent class="w-full h-full p-0">
        <router-view v-slot="{ Component, route }">
          <!-- 关键：KeepAlive 必须始终挂载，否则切换到非 keepAlive 路由时缓存会被销毁 -->
          <KeepAlive>
            <component :is="Component" v-if="route.meta?.keepAlive" :key="route.fullPath" />
          </KeepAlive>
          <component :is="Component" v-if="!route.meta?.keepAlive" :key="route.fullPath" />
        </router-view>
      </CardContent>
    </Card>
  </div>
</template>
