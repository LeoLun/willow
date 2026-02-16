<script setup lang="ts">
import { onMounted } from "vue";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-vue-next";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useInitStore } from "@/stores/init";
import TopDragBar from "@/components/base/TopDragBar.vue";

const initStore = useInitStore();

onMounted(() => {
  initStore.startInit();
});

function handleRetry() {
  initStore.startInit();
}
</script>

<template>
  <TopDragBar />
  <div
    class="flex h-screen w-screen items-center justify-center bg-background"
    role="main"
  >
    <div class="flex w-full max-w-sm flex-col items-center gap-6 px-6">
      <!-- Logo / 标题 -->
      <div class="flex flex-col items-center gap-2">
        <h1
          class="text-xl font-semibold tracking-tight text-foreground"
          style="text-wrap: balance"
        >
          Willow
        </h1>
        <p class="text-sm text-muted-foreground">正在准备你的工作环境</p>
      </div>

      <!-- 进度区域 -->
      <div class="flex w-full flex-col gap-3">
        <Progress
          :model-value="initStore.progressPercent"
          class="h-1.5 w-full"
        />

        <!-- 状态文案 -->
        <div
          class="flex min-h-[24px] items-center justify-center gap-2"
          aria-live="polite"
        >
          <!-- 加载中 -->
          <template
            v-if="
              initStore.step !== 'done' && initStore.step !== 'error'
            "
          >
            <Loader2
              class="size-3.5 animate-spin text-muted-foreground motion-reduce:animate-none"
              aria-hidden="true"
            />
            <span class="text-xs text-muted-foreground">
              {{ initStore.progressMessage }}
            </span>
          </template>

          <!-- 完成 -->
          <template v-else-if="initStore.step === 'done'">
            <CheckCircle2
              class="size-3.5 text-emerald-500"
              aria-hidden="true"
            />
            <span class="text-xs text-emerald-600 dark:text-emerald-400">
              {{ initStore.progressMessage }}
            </span>
          </template>

          <!-- 错误 -->
          <template v-else-if="initStore.step === 'error'">
            <AlertCircle
              class="size-3.5 text-destructive"
              aria-hidden="true"
            />
            <span class="text-xs text-destructive">
              {{ initStore.errorMessage }}
            </span>
          </template>
        </div>
      </div>

      <!-- 重试按钮（仅错误时显示） -->
      <Button
        v-if="initStore.step === 'error'"
        variant="outline"
        size="sm"
        class="focus-visible:ring-2 focus-visible:ring-ring"
        @click="handleRetry"
      >
        重新初始化
      </Button>
    </div>
  </div>
</template>
