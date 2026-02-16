<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import {
  Bot,
  User,
  Loader2,
  CheckCircle2,
  XCircle,
  Wrench,
  Brain,
  ChevronDown,
  ChevronRight,
} from "lucide-vue-next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useChatStore } from "@/stores/chat";
import type { Part, ToolPart } from "@opencode-ai/sdk/v2/client";

const chatStore = useChatStore();
const scrollRef = ref<InstanceType<typeof ScrollArea> | null>(null);
const bottomAnchorRef = ref<HTMLElement | null>(null);

/** 是否由用户主动滚到非底部（锁住自动滚动） */
const userScrolled = ref(false);

const sortedMessages = computed(() => chatStore.sortedMessages);

// ─── Part 渲染辅助 ───────────────────────────────────

/** 从 parts 中提取纯文本 */
function getTextFromParts(parts: Part[]): string {
  return parts
    .filter((p) => p.type === "text" && !p.synthetic)
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("\n");
}

/** 提取推理过程文本 */
function getReasoningFromParts(parts: Part[]): string {
  return parts
    .filter((p) => p.type === "reasoning")
    .map((p) => (p as { type: "reasoning"; text: string }).text)
    .join("\n");
}

/** 提取 tool parts */
function getToolParts(parts: Part[]): ToolPart[] {
  return parts.filter((p) => p.type === "tool") as ToolPart[];
}

/** 获取 tool 状态标签 */
function getToolStatusLabel(tool: ToolPart): string {
  switch (tool.state.status) {
    case "pending":
      return "等待执行";
    case "running":
      return (tool.state as { title?: string }).title || "执行中";
    case "completed":
      return (tool.state as { title: string }).title || "已完成";
    case "error":
      return "执行失败";
    default:
      return "";
  }
}

/** 获取消息显示文本 */
function getMessageText(msgId: string): string {
  const msgParts = chatStore.getMessageParts(msgId);
  if (msgParts.length > 0) {
    return getTextFromParts(msgParts);
  }
  return "";
}

/** 获取消息的推理过程 */
function getMessageReasoning(msgId: string): string {
  const msgParts = chatStore.getMessageParts(msgId);
  return getReasoningFromParts(msgParts);
}

/** 获取消息的工具调用 */
function getMessageTools(msgId: string): ToolPart[] {
  const msgParts = chatStore.getMessageParts(msgId);
  return getToolParts(msgParts);
}

/** 格式化时间 */
function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

// ─── 推理折叠状态 ──────────────────────────────────────
const expandedReasoning = ref<Set<string>>(new Set());

function toggleReasoning(msgId: string) {
  if (expandedReasoning.value.has(msgId)) {
    expandedReasoning.value.delete(msgId);
  } else {
    expandedReasoning.value.add(msgId);
  }
}

// ─── 自动滚动 ──────────────────────────────────────────

/**
 * 组件挂载后立即尝试滚动到底部。
 * 用于从草稿模式切换到历史会话时，MessageList 刚挂载的场景。
 */
onMounted(() => {
  userScrolled.value = false;
  forceScrollToBottom();
});

/**
 * 切换会话时重置滚动状态并滚动到底部。
 */
watch(
  () => chatStore.currentSessionId,
  () => {
    userScrolled.value = false;
    forceScrollToBottom();
  },
);

/**
 * 监听消息和 parts 的变化（流式输出时自动滚动）
 * 使用 partsMap 的引用变化来触发（因为每次 part 更新都会重新赋值数组）
 */
watch(
  [() => sortedMessages.value.length, () => chatStore.partsMap],
  () => {
    if (userScrolled.value) return;
    forceScrollToBottom();
  },
  { deep: true },
);

/**
 * 消息加载完成后滚动到底部（切换历史会话时）
 */
watch(
  () => chatStore.isLoading,
  (loading, prevLoading) => {
    if (prevLoading && !loading) {
      userScrolled.value = false;
      forceScrollToBottom();
    }
  },
);

/**
 * 强制滚动到底部。
 * 使用多重策略确保滚动生效：
 * 1. nextTick 等待 Vue DOM 更新
 * 2. 双重 rAF 等待浏览器布局完成
 * 3. setTimeout 兜底处理 ScrollArea 异步布局延迟
 */
async function forceScrollToBottom() {
  await nextTick();
  scrollToBottom();
  requestAnimationFrame(() => {
    scrollToBottom();
    requestAnimationFrame(() => {
      scrollToBottom();
    });
  });
  setTimeout(scrollToBottom, 50);
  setTimeout(scrollToBottom, 150);
  setTimeout(scrollToBottom, 400);
}

/** 获取 ScrollArea 内部真正的滚动容器 */
function getViewportEl(): HTMLElement | null {
  const root = scrollRef.value?.$el as HTMLElement | undefined;
  if (!root) return null;
  // reka-ui v2 使用 data-slot="scroll-area-viewport"
  // 兼容 radix-vue / reka-ui 早期版本的 data-radix-scroll-area-viewport
  return (
    root.querySelector("[data-slot='scroll-area-viewport']") ||
    root.querySelector("[data-radix-scroll-area-viewport]")
  ) as HTMLElement | null;
}

function scrollToBottom() {
  // 优先使用底部锚点（最可靠）
  if (bottomAnchorRef.value) {
    bottomAnchorRef.value.scrollIntoView({ block: "end", behavior: "instant" });
    return;
  }
  // 兜底：直接操作 viewport scrollTop
  const viewport = getViewportEl();
  if (viewport) {
    viewport.scrollTop = viewport.scrollHeight;
  }
}

function handleScroll(e: Event) {
  const el = e.target as HTMLElement;
  if (!el) return;
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  userScrolled.value = distanceFromBottom > 80;
}

/**
 * 挂载 scroll 监听器。
 * ScrollArea 内部的 viewport 不是 ref 直接指向的元素，
 * 需要在 mounted 后查找并监听。
 */
watch(scrollRef, (el) => {
  if (!el) return;
  const viewport = getViewportEl();
  viewport?.addEventListener("scroll", handleScroll, { passive: true });
});
</script>

<template>
  <ScrollArea ref="scrollRef" class="min-h-0 flex-1 px-4">
    <div class="mx-auto max-w-3xl space-y-6 py-6">
      <!-- 空状态 -->
      <template v-if="sortedMessages.length === 0 && !chatStore.isLoading">
        <div class="flex h-full min-h-[200px] items-center justify-center">
          <p class="text-sm text-muted-foreground">发送一条消息开始对话</p>
        </div>
      </template>

      <!-- 消息列表 -->
      <div
        v-for="msg in sortedMessages"
        :key="msg.id"
        class="flex gap-3"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <!-- Assistant 头像 -->
        <Avatar
          v-if="msg.role === 'assistant'"
          class="mt-0.5 size-7 shrink-0"
        >
          <AvatarFallback class="bg-primary/10 text-primary">
            <Bot class="size-3.5" aria-hidden="true" />
          </AvatarFallback>
        </Avatar>

        <!-- 消息内容 -->
        <div
          class="max-w-[80%] space-y-2"
          :class="msg.role === 'user' ? 'items-end' : 'items-start'"
        >
          <!-- ─── 用户消息 ─── -->
          <template v-if="msg.role === 'user'">
            <div class="rounded-xl bg-primary px-4 py-2.5 text-primary-foreground">
              <p class="whitespace-pre-wrap text-sm leading-relaxed break-words">
                {{ getMessageText(msg.id) }}
              </p>
              <time
                class="mt-1 block text-[10px] opacity-50"
                :datetime="new Date(msg.time.created * 1000).toISOString()"
              >
                {{ formatTime(msg.time.created) }}
              </time>
            </div>
          </template>

          <!-- ─── 助手消息 ─── -->
          <template v-else>
            <!-- 推理过程（可折叠） -->
            <div
              v-if="getMessageReasoning(msg.id)"
              class="w-full"
            >
              <button
                class="flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-muted-foreground"
                @click="toggleReasoning(msg.id)"
              >
                <Brain class="size-3" aria-hidden="true" />
                <ChevronDown
                  v-if="expandedReasoning.has(msg.id)"
                  class="size-3"
                  aria-hidden="true"
                />
                <ChevronRight v-else class="size-3" aria-hidden="true" />
                <span>思考过程</span>
              </button>
              <div
                v-if="expandedReasoning.has(msg.id)"
                class="mt-1 rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
              >
                <p class="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground break-words">
                  {{ getMessageReasoning(msg.id) }}
                </p>
              </div>
            </div>

            <!-- 工具调用 -->
            <div
              v-for="tool in getMessageTools(msg.id)"
              :key="tool.id"
              class="flex w-full items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-xs"
            >
              <Wrench
                class="size-3 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span class="min-w-0 truncate font-mono text-muted-foreground">
                {{ tool.tool }}
              </span>
              <span class="ml-auto flex shrink-0 items-center gap-1">
                <Loader2
                  v-if="tool.state.status === 'pending' || tool.state.status === 'running'"
                  class="size-3 animate-spin text-muted-foreground"
                  aria-hidden="true"
                />
                <CheckCircle2
                  v-else-if="tool.state.status === 'completed'"
                  class="size-3 text-green-500"
                  aria-hidden="true"
                />
                <XCircle
                  v-else-if="tool.state.status === 'error'"
                  class="size-3 text-destructive"
                  aria-hidden="true"
                />
                <span class="text-muted-foreground/70">
                  {{ getToolStatusLabel(tool) }}
                </span>
              </span>
            </div>

            <!-- 文本内容气泡 -->
            <div
              v-if="getMessageText(msg.id)"
              class="rounded-xl bg-muted px-4 py-2.5 text-foreground"
            >
              <p class="whitespace-pre-wrap text-sm leading-relaxed break-words">
                {{ getMessageText(msg.id) }}
              </p>
              <time
                class="mt-1 block text-[10px] opacity-50"
                :datetime="new Date(msg.time.created * 1000).toISOString()"
              >
                {{ formatTime(msg.time.created) }}
              </time>
            </div>

            <!-- 还没有文本内容且正在生成 -->
            <div
              v-else-if="chatStore.isGenerating"
              class="rounded-xl bg-muted px-4 py-2.5 text-foreground"
            >
              <span class="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Loader2 class="size-3.5 animate-spin" aria-hidden="true" />
                思考中…
              </span>
            </div>
          </template>
        </div>

        <!-- User 头像 -->
        <Avatar v-if="msg.role === 'user'" class="mt-0.5 size-7 shrink-0">
          <AvatarFallback class="bg-secondary text-secondary-foreground">
            <User class="size-3.5" aria-hidden="true" />
          </AvatarFallback>
        </Avatar>
      </div>

      <!-- 全局生成中指示器 -->
      <div
        v-if="chatStore.isGenerating && sortedMessages.length > 0"
        class="flex justify-start gap-3"
      >
        <div class="size-7 shrink-0" />
        <div class="flex items-center gap-1.5 px-1 py-2">
          <span class="flex gap-0.5">
            <span
              class="size-1.5 animate-bounce rounded-full bg-muted-foreground/40"
              style="animation-delay: 0ms"
            />
            <span
              class="size-1.5 animate-bounce rounded-full bg-muted-foreground/40"
              style="animation-delay: 150ms"
            />
            <span
              class="size-1.5 animate-bounce rounded-full bg-muted-foreground/40"
              style="animation-delay: 300ms"
            />
          </span>
        </div>
      </div>

      <!-- 会话错误提示 -->
      <div
        v-if="chatStore.sessionError"
        class="flex justify-start gap-3"
      >
        <div class="size-7 shrink-0" />
        <div class="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <XCircle class="size-3.5 shrink-0" aria-hidden="true" />
          <span>{{ chatStore.sessionError }}</span>
        </div>
      </div>
    </div>
    <!-- 底部锚点，用于 scrollIntoView -->
    <div ref="bottomAnchorRef" aria-hidden="true" />
  </ScrollArea>
</template>
