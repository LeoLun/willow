<script setup lang="ts">
import { Sender } from "@willow/sender";
import { Badge } from "@willow/shadcn";
import { Button } from "@willow/shadcn/components/ui/button";
import { MessageList } from "@willow/ui";
import { ref, computed } from "vue";
import DialogProvider from "../../../../work/src/renderer/src/layout/dialog/DialogProvider.vue";
import WelcomeView from "../../../../work/src/renderer/src/pages/chat/session/components/WelcomeView.vue";
import {
  senderModels,
  senderPlugins,
  senderSkills,
  senderFiles,
  conversationMessages,
} from "../mock-data";

const isStreaming = ref(false);
const showUsage = ref(true);
const selectedModelId = ref(senderModels[0]?.modelId ?? "");
const webSearchEnabled = ref(true);

const hasMessages = ref(false); // Toggle state: false = empty/welcome, true = message list
const eventLogs = ref<string[]>([]);

const mockWorkspaces = [
  { id: 1, name: "willow" },
  { id: 2, name: "poet-engine" },
  { id: 3, name: "my-react-app" },
];
const currentWorkspaceId = ref(1);
const chatScope = ref<"conversation" | "workspace">("conversation"); // Defaults to conversation (对话)

const currentWorkspaceName = computed(() => {
  if (chatScope.value === "conversation") {
    return "对话";
  }
  return mockWorkspaces.find((w) => w.id === currentWorkspaceId.value)?.name ?? "willow";
});

function logEvent(name: string, desc: string) {
  eventLogs.value.unshift(`[${new Date().toLocaleTimeString()}] ${name}: ${desc}`);
}

function handleSend(payload: any) {
  logEvent("send", `发送消息: "${payload.message}"`);
  if (payload.message) {
    hasMessages.value = true;
    logEvent("state-change", "检测到发送消息，自动切换为已激活会话状态");
  }
}

function handleStop() {
  isStreaming.value = false;
  logEvent("stop", "停止流式接收");
}

function handleOpenSettings() {
  logEvent("open-settings", "前往设置配置模型");
}

function handleSelectWorkspace(id: number) {
  if (id === -1) {
    chatScope.value = "conversation";
    logEvent("select-workspace", "切换到全局对话模式 (对话)");
  } else {
    chatScope.value = "workspace";
    currentWorkspaceId.value = id;
    logEvent(
      "select-workspace",
      `切换到工作空间: "${mockWorkspaces.find((w) => w.id === id)?.name}"`,
    );
  }
}
</script>

<template>
  <div class="grid gap-6">
    <!-- Controls header -->
    <div
      class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-muted/20 p-4"
    >
      <div class="flex flex-col gap-1">
        <h3 class="text-sm font-semibold text-foreground">欢迎首页调试控制台</h3>
        <p class="text-xs text-muted-foreground">
          你可以手动切换不同的会话模式或数据状态，验证交互与弹窗效果。
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <!-- Chat scope toggle -->
        <div class="flex items-center gap-1.5 rounded-xl border border-border bg-card p-1">
          <Button
            :variant="chatScope === 'workspace' ? 'secondary' : 'ghost'"
            size="xs"
            class="h-7 cursor-pointer rounded-lg text-xs"
            @click="
              chatScope = 'workspace';
              logEvent('scope-change', '切换至工作空间模式');
            "
          >
            工作空间模式
          </Button>
          <Button
            :variant="chatScope === 'conversation' ? 'secondary' : 'ghost'"
            size="xs"
            class="h-7 cursor-pointer rounded-lg text-xs"
            @click="
              chatScope = 'conversation';
              logEvent('scope-change', '切换至全局对话模式');
            "
          >
            全局对话模式
          </Button>
        </div>

        <!-- Session status toggle -->
        <div class="flex items-center gap-1.5 rounded-xl border border-border bg-card p-1">
          <Button
            :variant="!hasMessages ? 'secondary' : 'ghost'"
            size="xs"
            class="h-7 cursor-pointer rounded-lg text-xs"
            @click="
              hasMessages = false;
              logEvent('state-change', '切换到空白/欢迎首页状态');
            "
          >
            模拟空会话
          </Button>
          <Button
            :variant="hasMessages ? 'secondary' : 'ghost'"
            size="xs"
            class="h-7 cursor-pointer rounded-lg text-xs"
            @click="
              hasMessages = true;
              logEvent('state-change', '切换到活跃会话状态');
            "
          >
            模拟活跃会话
          </Button>
        </div>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-[1fr_300px]">
      <!-- Central Panel Mocking Session.vue -->
      <div
        class="flex min-h-[500px] flex-col rounded-3xl border border-border bg-card p-6 shadow-sm"
      >
        <!-- Session Content Wrapper -->
        <div class="flex min-h-0 flex-1 flex-col justify-center">
          <!-- Welcome Page view with slots when empty -->
          <WelcomeView
            v-if="!hasMessages"
            :current-workspace-name="currentWorkspaceName"
            :chat-scope="chatScope"
            :workspaces="mockWorkspaces"
            @create-workspace="logEvent('create-workspace', '引导弹窗 -> 触发创建工作空间事件')"
            @go-to-settings="logEvent('go-to-settings', '引导弹窗 -> 触发前往设置模型事件')"
            @select-workspace="handleSelectWorkspace"
          >
            <!-- Slot the Sender into the WelcomeView center -->
            <template #sender>
              <Sender
                :messages="[]"
                :is-streaming="isStreaming"
                :show-usage="false"
                :models="senderModels"
                :default-model-id="senderModels[0]?.modelId ?? ''"
                :selected-model-id="selectedModelId"
                :plugins="senderPlugins"
                :skills="senderSkills"
                :files="senderFiles"
                :web-search-enabled="webSearchEnabled"
                @send="handleSend"
                @stop="handleStop"
                @open-settings="handleOpenSettings"
                @update:selected-model-id="selectedModelId = $event"
                @update:web-search-enabled="webSearchEnabled = $event"
              />
            </template>
          </WelcomeView>

          <!-- Regular message list when active -->
          <div v-else class="flex-1 py-4">
            <div class="mb-6 flex-1 overflow-y-auto">
              <MessageList :messages="conversationMessages" />
            </div>

            <!-- Bottom Sender when active -->
            <div class="border-t border-border pt-4">
              <Sender
                :messages="conversationMessages"
                :is-streaming="isStreaming"
                :show-usage="showUsage"
                :models="senderModels"
                :default-model-id="senderModels[0]?.modelId ?? ''"
                :selected-model-id="selectedModelId"
                :plugins="senderPlugins"
                :skills="senderSkills"
                :files="senderFiles"
                :web-search-enabled="webSearchEnabled"
                @send="handleSend"
                @stop="handleStop"
                @open-settings="handleOpenSettings"
                @update:selected-model-id="selectedModelId = $event"
                @update:web-search-enabled="webSearchEnabled = $event"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar Logger and tips -->
      <div class="flex flex-col gap-4">
        <!-- Event Logger -->
        <div class="flex h-[300px] flex-col rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h3 class="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            事件交互日志
          </h3>
          <div class="flex-1 space-y-1.5 overflow-y-auto font-mono text-xs text-foreground">
            <div v-if="eventLogs.length === 0" class="text-muted-foreground italic">
              等待用户交互...
            </div>
            <div
              v-for="(log, idx) in eventLogs"
              :key="idx"
              class="border-b border-border/50 pb-1 last:border-0"
            >
              {{ log }}
            </div>
          </div>
        </div>

        <!-- Debug details -->
        <div class="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h3 class="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            交互与验证指引
          </h3>
          <ul class="list-inside list-disc space-y-2 text-xs text-muted-foreground">
            <li>
              默认状态为
              <span class="font-semibold text-emerald-400">对话</span>
              模式，底部输入框左下侧展示“对话”图标及文字。
            </li>
            <li>
              点击输入框左下方的
              <span class="font-semibold text-foreground">对话 v</span>
              ，下拉菜单中可以切换选择其他工作空间（例如 `willow`），此时切换为工作空间模式。
            </li>
            <li>
              点击输入框右下方的
              <span class="font-medium text-primary">“配置与使用指引”</span>
              ，同样可以拉起新手引导弹窗。
            </li>
            <li>点击底部的建议提示词，文字会自动填充并聚焦。</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <!-- Dialog Provider to render the Guide dialog dynamically -->
  <DialogProvider />
</template>
