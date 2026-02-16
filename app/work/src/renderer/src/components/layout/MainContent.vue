<script setup lang="ts">
import { ref, computed } from "vue";
import { Sparkles, SendHorizontal, FolderOpen, X } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import MessageList from "@/components/chat/MessageList.vue";
import ChatInput from "@/components/chat/ChatInput.vue";
import { useChatStore } from "@/stores/chat";
import { useInitStore } from "@/stores/init";
import { electronAPI } from "@renderer/src/lib/ipc";

const chatStore = useChatStore();
const initStore = useInitStore();

const hasActiveSession = computed(
  () => !!chatStore.currentSessionId && !chatStore.isDraftSession,
);

// ─── 新建对话页 ──────────────────────────────────────────
const draftInput = ref("");
const draftTextareaRef = ref<HTMLTextAreaElement | null>(null);

/** 显示的目录路径（自定义或默认） */
const displayDirectory = computed(() => {
  return chatStore.draftDirectory || initStore.baseStartPath || "默认目录";
});

/** 是否使用了自定义目录（非默认） */
const isCustomDirectory = computed(() => !!chatStore.draftDirectory);

/** 将完整路径缩短为可读的短路径 */
function shortenPath(fullPath: string): string {
  const home =
    typeof process !== "undefined" && process.env?.HOME
      ? process.env.HOME
      : "";
  if (home && fullPath.startsWith(home)) {
    return "~" + fullPath.slice(home.length);
  }
  return fullPath;
}

async function handleSelectDirectory() {
  const result = await electronAPI.selectDirectory(
    chatStore.draftDirectory || initStore.baseStartPath || undefined,
  );
  if (result.selected && result.path) {
    chatStore.setDraftDirectory(result.path);
  }
}

function handleResetDirectory() {
  chatStore.setDraftDirectory(null);
}

async function handleDraftSend() {
  const text = draftInput.value.trim();
  if (!text || chatStore.isSending) return;
  draftInput.value = "";
  await chatStore.sendMessage(text);
}

function handleDraftKeyDown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleDraftSend();
  }
}
</script>

<template>
  <main class="flex h-full flex-col overflow-hidden">
    <!-- 有活跃会话 → 消息列表 + 输入框 -->
    <template v-if="hasActiveSession">
      <MessageList />
      <ChatInput />
    </template>

    <!-- 无活跃会话（含草稿模式）→ 新建对话页面 -->
    <template v-else>
      <TooltipProvider :delay-duration="300">
        <div class="flex flex-1 flex-col items-center justify-center px-4">
          <!-- 标题区域 -->
          <div class="mb-8 flex flex-col items-center gap-3 text-center">
            <div
              class="flex size-14 items-center justify-center rounded-2xl bg-primary/10"
            >
              <Sparkles
                class="size-7 text-primary"
                aria-hidden="true"
              />
            </div>
            <div>
              <h2
                class="text-xl font-semibold text-foreground"
                style="text-wrap: balance"
              >
                有什么可以帮你的？
              </h2>
              <p class="mt-1 text-sm text-muted-foreground">
                输入你的问题，开始一段新对话
              </p>
            </div>
          </div>

          <!-- 居中输入区域 -->
          <div class="w-full max-w-2xl">
            <div
              class="flex items-end gap-2 rounded-xl border bg-background p-2 shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-ring"
            >
              <Textarea
                ref="draftTextareaRef"
                v-model="draftInput"
                placeholder="输入消息…"
                rows="2"
                class="max-h-[160px] min-h-[56px] flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                autocomplete="off"
                :disabled="chatStore.isSending"
                @keydown="handleDraftKeyDown"
              />
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    size="icon"
                    :disabled="!draftInput.trim() || chatStore.isSending"
                    aria-label="发送消息"
                    class="mb-0.5 shrink-0"
                    @click="handleDraftSend"
                  >
                    <SendHorizontal class="size-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent> 发送消息 </TooltipContent>
              </Tooltip>
            </div>

            <!-- 目录选择器 -->
            <div class="mt-3 flex items-center justify-center gap-2">
              <Tooltip>
                <TooltipTrigger as-child>
                  <button
                    class="inline-flex max-w-md items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    @click="handleSelectDirectory"
                  >
                    <FolderOpen class="size-3.5 shrink-0" aria-hidden="true" />
                    <span class="min-w-0 truncate">{{ shortenPath(displayDirectory) }}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {{ isCustomDirectory ? '点击更换操作目录' : '点击选择操作目录（当前为默认目录）' }}
                </TooltipContent>
              </Tooltip>
              <Tooltip v-if="isCustomDirectory">
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="size-6 text-muted-foreground hover:text-foreground"
                    aria-label="恢复默认目录"
                    @click="handleResetDirectory"
                  >
                    <X class="size-3" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent> 恢复默认目录 </TooltipContent>
              </Tooltip>
            </div>

            <p
              class="mt-2 text-center text-[10px] text-muted-foreground/50"
            >
              Enter 发送，Shift+Enter 换行
            </p>
          </div>
        </div>
      </TooltipProvider>
    </template>
  </main>
</template>
