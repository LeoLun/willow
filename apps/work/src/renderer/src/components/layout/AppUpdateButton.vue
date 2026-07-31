<script setup lang="ts">
import { computed } from "vue";
import { useDialog } from "@/components/dialog";
import RestartUpdateDialog from "@/components/dialog/update/RestartUpdateDialog.vue";
import { Button } from "@/components/ui/button";
import { useAppUpdate } from "@/composables/useAppUpdate";
import { useMessageStatus } from "@/composables/useMessage";

const { state, visible, downloadUpdate, restartToUpdate, openManualUpdate } = useAppUpdate();
const { hasRunningSessions } = useMessageStatus();
const { openDialog } = useDialog();
const progress = computed(() => (state.value.status === "downloading" ? state.value.progress : 0));
const progressOffset = computed(() => 100 - progress.value);
const title = computed(() =>
  state.value.status === "downloadFailed" ? "下载失败，点击重试" : undefined,
);

async function handleClick(): Promise<void> {
  console.log("handleClick", state.value.status);
  if (state.value.status === "manualAvailable") {
    await openManualUpdate();
  } else if (state.value.status === "ready") {
    if (hasRunningSessions.value) {
      openDialog(
        RestartUpdateDialog,
        { onConfirm: restartToUpdate },
        { contentClass: "sm:max-w-md" },
      );
    } else {
      await restartToUpdate();
    }
  } else if (state.value.status === "hotAvailable" || state.value.status === "downloadFailed") {
    await downloadUpdate();
  }
}
</script>

<template>
  <Button
    v-if="visible"
    variant="borderless"
    shape="capsule"
    :class="state.status === 'downloading' ? 'size-9 shrink-0 px-0' : 'shrink-0 px-4'"
    :title="title"
    :disabled="state.status === 'downloading'"
    @click="handleClick"
  >
    <template v-if="state.status === 'downloading'">
      <svg
        class="size-5 -rotate-90"
        viewBox="0 0 36 36"
        role="progressbar"
        :aria-valuenow="progress"
      >
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke="currentColor"
          stroke-opacity=".2"
          stroke-width="3"
        />
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          pathLength="100"
          stroke-linecap="round"
          :stroke-dasharray="100"
          :stroke-dashoffset="progressOffset"
        />
      </svg>
      <span class="sr-only">下载进度 {{ progress }}%</span>
    </template>
    <template v-else>{{ state.status === "ready" ? "重启" : "更新" }}</template>
  </Button>
</template>
