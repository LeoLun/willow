<script setup lang="ts">
import { ref, computed } from "vue";
import { SendHorizontal, Square } from "lucide-vue-next";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChatStore } from "@/stores/chat";

const chatStore = useChatStore();
const inputText = ref("");
const textareaRef = ref<HTMLTextAreaElement | null>(null);

/** 是否处于「忙碌」状态（正在发送请求 或 助手正在生成） */
const isBusy = computed(() => chatStore.isSending || chatStore.isGenerating);

async function handleSend() {
  const text = inputText.value.trim();
  if (!text || isBusy.value) return;

  inputText.value = "";
  await chatStore.sendMessage(text);
}

function handleKeyDown(e: KeyboardEvent) {
  // Enter 发送，Shift+Enter 换行
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

function handleAbort() {
  chatStore.abortSession();
}
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <div class="shrink-0 border-t bg-background px-4 py-3">
      <div class="mx-auto flex max-w-3xl items-end gap-2">
        <Textarea
          ref="textareaRef"
          v-model="inputText"
          placeholder="输入消息…"
          rows="1"
          class="max-h-[120px] min-h-[40px] flex-1 resize-none"
          autocomplete="off"
          :disabled="isBusy"
          @keydown="handleKeyDown"
        />

        <!-- 发送/停止 按钮 -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              v-if="!isBusy"
              size="icon"
              :disabled="!inputText.trim()"
              :aria-label="'发送消息'"
              class="shrink-0"
              @click="handleSend"
            >
              <SendHorizontal class="size-4" aria-hidden="true" />
            </Button>
            <Button
              v-else
              size="icon"
              variant="destructive"
              aria-label="停止生成"
              class="shrink-0"
              @click="handleAbort"
            >
              <Square class="size-3.5" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {{ isBusy ? '停止生成' : '发送消息' }}
          </TooltipContent>
        </Tooltip>
      </div>
      <p class="mx-auto mt-1.5 max-w-3xl text-center text-[10px] text-muted-foreground/50">
        Enter 发送，Shift+Enter 换行
      </p>
    </div>
  </TooltipProvider>
</template>
