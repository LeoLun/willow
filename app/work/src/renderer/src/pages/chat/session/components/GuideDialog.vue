<script setup lang="ts">
import { Button } from "@willow/shadcn/components/ui/button";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@willow/shadcn/components/ui/dialog";
import { ref, onBeforeMount, computed } from "vue";
import { useConfigStore } from "@/stores/config";
import guideAutomations from "../../../../assets/guide_automations.png";
import guideModelConfig from "../../../../assets/guide_model_config.png";
import guideWorkspaces from "../../../../assets/guide_workspaces.png";

const emit = defineEmits<{
  close: [];
  "create-workspace": [];
  "go-to-settings": [];
}>();

const configStore = useConfigStore();

onBeforeMount(async () => {
  await configStore.fetchModelList();
});

const isModelConfigured = computed(() => {
  return configStore.modelList.some((m) => !!m.apiKey);
});

function handleGoToSettings() {
  emit("go-to-settings");
  emit("close");
}

const currentStep = ref(0);

const steps = [
  {
    title: "1. 配置模型密钥 (Model Config)",
    description:
      "Willow 支持极简的 DeepSeek 配置。前往设置填入你的 API Key，系统将自动激活内置的 V4 Pro 和 Flash 双模型。",
    image: guideModelConfig,
  },
  {
    title: "2. 绑定项目工作空间 (Workspaces)",
    description:
      "你可以将 Willow 绑定至本地开发目录或文件夹。工作空间专属 Agent 将深度理解代码库，并为你自动编写与修改代码。",
    image: guideWorkspaces,
  },
  {
    title: "3. 后台自动化工作流 (Automations)",
    description:
      "针对重复性高、流程长的处理任务，你可以配置 Cron 定时或按需运行的 AI 自动化流，关闭界面后依然会在后台静默完成。",
    image: guideAutomations,
  },
];
</script>

<template>
  <div class="flex max-h-[85vh] min-h-[460px] flex-col gap-6 py-1">
    <!-- Step Transition Container (Header + Body) -->
    <div class="relative flex min-h-[380px] flex-1 flex-col justify-between overflow-hidden">
      <Transition name="fade" mode="out-in">
        <div :key="currentStep" class="flex flex-col gap-6">
          <!-- Dialog Header -->
          <DialogHeader class="text-left">
            <DialogTitle class="flex items-center justify-between gap-2 text-lg font-bold">
              <span>{{ steps[currentStep].title }}</span>
              <span class="text-xs font-normal text-muted-foreground select-none"
                >步骤 {{ currentStep + 1 }} / 3</span
              >
            </DialogTitle>
            <DialogDescription class="min-h-[40px] text-sm leading-relaxed">
              {{ steps[currentStep].description }}
            </DialogDescription>
          </DialogHeader>

          <!-- Screenshot Area -->
          <div class="flex flex-col items-center justify-center">
            <div
              class="flex max-h-[260px] w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/20 shadow-xs"
            >
              <img
                :src="steps[currentStep].image"
                :alt="steps[currentStep].title"
                class="h-auto max-h-[260px] w-full animate-in object-cover object-top duration-300 select-none zoom-in-95 fade-in"
              />
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Dialog Footer -->
    <DialogFooter class="flex w-full flex-row items-center justify-between pt-2 sm:justify-between">
      <!-- Indicators -->
      <div class="flex items-center gap-2">
        <span
          v-for="(_, idx) in steps"
          :key="idx"
          class="size-2 rounded-full transition-all duration-300"
          :class="idx === currentStep ? 'w-4 bg-primary' : 'bg-muted-foreground/30'"
        />
      </div>

      <!-- Action buttons -->
      <div class="flex items-center gap-2">
        <Button
          v-if="currentStep > 0"
          variant="outline"
          size="sm"
          class="h-8 cursor-pointer px-3 text-xs"
          @click="currentStep--"
        >
          上一页
        </Button>
        <Button
          v-if="currentStep < 2"
          variant="default"
          size="sm"
          class="h-8 cursor-pointer px-3 text-xs"
          @click="currentStep++"
        >
          下一页
        </Button>
        <Button
          v-else
          variant="default"
          size="sm"
          class="h-8 cursor-pointer px-3 text-xs"
          @click="isModelConfigured ? emit('close') : handleGoToSettings()"
        >
          {{ isModelConfigured ? "确定" : "前往设置模型" }}
        </Button>
      </div>
    </DialogFooter>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
