<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, FileUp, PenLine } from 'lucide-vue-next'

const router = useRouter()

const go = (name: string) => {
  router.push({ name })
}
</script>
<template>
  <div class="flex flex-col w-full h-full overflow-hidden">
    <div class="flex items-center justify-between p-4 border-b">
      <div class="min-w-0">
        <div class="text-base font-semibold">首页</div>
        <div class="text-xs text-muted-foreground">选择一个功能开始使用</div>
      </div>
    </div>

    <div class="flex-1 overflow-auto p-4">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <Card
          role="button"
          tabindex="0"
          class="cursor-pointer transition-shadow hover:shadow-sm"
          @click="go('Upload')"
          @keydown.enter="go('Upload')"
        >
          <CardHeader class="p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <div class="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                  <FileUp class="h-5 w-5 text-primary" />
                </div>
                <div class="min-w-0">
                  <CardTitle class="text-sm">上传账单</CardTitle>
                  <CardDescription class="text-xs">导入文件 → AI 分类 → 上传到 Notion</CardDescription>
                </div>
              </div>
              <ArrowRight class="h-4 w-4 text-muted-foreground mt-1" />
            </div>
          </CardHeader>
          <CardContent class="px-4 pb-4 pt-0">
            <Button class="w-full justify-between" variant="secondary" @click.stop="go('Upload')">
              进入
              <ArrowRight class="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <!-- 第二行第一个：AI 重命名引导 -->
        <Card
          role="button"
          tabindex="0"
          class="cursor-pointer transition-shadow hover:shadow-sm"
          @click="go('AiRename')"
          @keydown.enter="go('AiRename')"
        >
          <CardHeader class="p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <div class="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                  <PenLine class="h-5 w-5 text-primary" />
                </div>
                <div class="min-w-0">
                  <CardTitle class="text-sm">AI 重命名</CardTitle>
                  <CardDescription class="text-xs">选文件 → AI 推荐 3 个名字 → 一键重命名</CardDescription>
                </div>
              </div>
              <ArrowRight class="h-4 w-4 text-muted-foreground mt-1" />
            </div>
          </CardHeader>
          <CardContent class="px-4 pb-4 pt-0">
            <Button class="w-full justify-between" variant="secondary" @click.stop="go('AiRename')">
              进入
              <ArrowRight class="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>