<script setup lang="ts">
import type { SenderSendPayload } from "@willow/sender";
import { Sender } from "@willow/sender";
import { Badge } from "@willow/shadcn";
import { computed, ref } from "vue";
import { senderMessages, senderModels, senderSkills, senderStreamMessage } from "../mock-data";

const isStreaming = ref(false);
const showUsage = ref(true);
const selectedModelId = ref(senderModels[0]?.modelId ?? "");
const webSearchEnabled = ref(true);
const latestPayload = ref<SenderSendPayload | null>(null);
const latestEvent = ref("等待输入");

const eventSummary = computed(() => {
  if (!latestPayload.value) {
    return "还没有触发 send 事件。你可以输入 `/` 搜索技能，再试一次发送。";
  }

  const selectedSkillNames =
    latestPayload.value.selectedSkills?.map((skill) => skill.name).join("、") || "无";

  return `模型：${latestPayload.value.modelId || "未选择"}；联网：${
    latestPayload.value.webSearchEnabled ? "开启" : "关闭"
  }；技能：${selectedSkillNames}`;
});

function handleSend(payload: SenderSendPayload) {
  console.log("handleSend", payload);
  latestPayload.value = payload;
  latestEvent.value = "已收到 send 事件";
}

function handleStop() {
  isStreaming.value = false;
  latestEvent.value = "已收到 stop 事件";
}

function handleOpenSettings() {
  latestEvent.value = "已收到 open-settings 事件";
}
</script>

<template>
  <div class="grid gap-4">
    <div class="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div class="flex flex-wrap items-center gap-2">
        <Badge variant="outline">slash 搜索</Badge>
        <Badge variant="outline">技能胶囊</Badge>
        <Badge variant="outline">模型选择</Badge>
        <Badge variant="outline">发送事件</Badge>
      </div>

      <div>
        <h3 class="text-sm font-semibold text-foreground">共享 Sender</h3>
        <p class="mt-1 text-sm text-muted-foreground">
          这个场景不依赖 Electron IPC。输入 `/`
          可以直接验证技能搜索面板、键盘选择和发送事件是否正常。
        </p>
      </div>

      <Sender
        :messages="senderMessages"
        :is-streaming="isStreaming"
        :stream-message="isStreaming ? senderStreamMessage : null"
        :show-usage="showUsage"
        :models="senderModels"
        :default-model-id="senderModels[0]?.modelId ?? ''"
        :selected-model-id="selectedModelId"
        :skills="senderSkills"
        :web-search-enabled="webSearchEnabled"
        @send="handleSend"
        @stop="handleStop"
        @open-settings="handleOpenSettings"
        @update:selected-model-id="selectedModelId = $event"
        @update:web-search-enabled="webSearchEnabled = $event"
      />
    </div>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div class="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 class="text-sm font-semibold text-foreground">最近一次事件</h3>
        <p class="text-sm text-muted-foreground">{{ latestEvent }}</p>
        <p class="text-sm leading-6 text-foreground">{{ eventSummary }}</p>
      </div>

      <div class="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 class="text-sm font-semibold text-foreground">调试开关</h3>

        <label class="flex items-center justify-between gap-3 text-sm text-foreground">
          <span>流式输出态</span>
          <input v-model="isStreaming" type="checkbox" class="size-4 accent-primary" />
        </label>

        <label class="flex items-center justify-between gap-3 text-sm text-foreground">
          <span>显示 usage</span>
          <input v-model="showUsage" type="checkbox" class="size-4 accent-primary" />
        </label>

        <div class="rounded-xl border border-dashed border-border bg-muted/35 p-3">
          <div class="text-xs leading-5 text-muted-foreground">
            建议手动验证： 输入 `/work`、方向键上下切换、Enter 选中技能、Cmd/Ctrl + Enter 发送。
          </div>
        </div>
      </div>
    </div>

    <div class="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 class="text-sm font-semibold text-foreground">最近一次 payload</h3>
      <pre
        class="overflow-x-auto rounded-xl border border-border bg-muted/35 p-4 text-xs leading-6 text-foreground"
        >{{ JSON.stringify(latestPayload, null, 2) }}</pre
      >
    </div>
  </div>
</template>
