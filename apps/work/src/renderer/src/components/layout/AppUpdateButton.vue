<script setup lang="ts">
import { Button } from "@willow/shadcn/components/ui/button";
import { computed } from "vue";
import { useDialog } from "@/components/dialog";
import RestartUpdateDialog from "@/components/dialog/update/RestartUpdateDialog.vue";
import { useAppUpdate } from "@/composables/useAppUpdate";
import { useMessageStatus } from "@/composables/useMessage";

const { state, visible, downloadUpdate, restartToUpdate, openManualUpdate } = useAppUpdate();
const { hasRunningSessions } = useMessageStatus();
const { openDialog } = useDialog();

const isDownloading = computed(() => state.value.status === "downloading");
const progress = computed(() => {
  if (state.value.status !== "downloading") return 0;
  return Math.min(100, Math.max(1, Math.round(state.value.progress)));
});
const title = computed(() =>
  state.value.status === "downloadFailed" ? "下载失败，点击重试" : undefined,
);

async function handleClick(): Promise<void> {
  const currentState = state.value;

  if (currentState.status === "manualAvailable") {
    await openManualUpdate();
  } else if (currentState.status === "ready") {
    if (hasRunningSessions.value) {
      openDialog(
        RestartUpdateDialog,
        { onConfirm: restartToUpdate },
        { contentClass: "sm:max-w-md" },
      );
    } else {
      await restartToUpdate();
    }
  } else if (currentState.status === "hotAvailable" || currentState.status === "downloadFailed") {
    await downloadUpdate();
  }
}
</script>

<template>
  <Button
    v-if="visible"
    size="sm"
    :variant="isDownloading ? 'ghost' : 'default'"
    class="relative h-7 w-16 overflow-hidden rounded-full px-0"
    :class="isDownloading && 'bg-primary/15 text-primary disabled:opacity-100'"
    :title="title"
    :disabled="isDownloading"
    @click="handleClick"
  >
    <template v-if="isDownloading">
      <span
        class="absolute inset-0"
        role="progressbar"
        aria-valuemin="1"
        aria-valuemax="100"
        :aria-valuenow="progress"
        :aria-label="`下载进度 ${progress}%`"
      >
        <span
          data-update-progress-fill
          class="absolute inset-y-0 left-0 bg-primary transition-[width] duration-200 ease-linear"
          :style="{ width: `${progress}%` }"
          aria-hidden="true"
        />
      </span>
      <span class="relative z-10 text-primary" aria-hidden="true">{{ progress }}%</span>
      <span
        class="absolute inset-y-0 left-0 z-20 overflow-hidden transition-[width] duration-200 ease-linear"
        :style="{ width: `${progress}%` }"
        aria-hidden="true"
      >
        <span class="flex h-full w-16 items-center justify-center text-primary-foreground">
          {{ progress }}%
        </span>
      </span>
    </template>
    <template v-else>{{ state.status === "ready" ? "重启" : "更新" }}</template>
  </Button>
</template>
