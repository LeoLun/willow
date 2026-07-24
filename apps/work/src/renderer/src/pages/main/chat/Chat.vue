<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { MessageList } from "@/components/message-list";
import { useSessionMessages } from "@/composables/useMessage";

const route = useRoute();
const messageViewport = ref<HTMLElement>();

const workspaceId = computed(() => {
  const value = Number(route.query.workspaceId);
  return Number.isInteger(value) && value > 0 ? value : undefined;
});

const sessionId = computed(() => {
  const value = route.params.sessionId;
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
});

const { timeline, loading } = useSessionMessages(workspaceId, sessionId);

watch(timeline, async () => {
  await nextTick();
  const viewport = messageViewport.value;
  if (viewport) viewport.scrollTop = viewport.scrollHeight;
});
</script>

<template>
  <div
    class="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden"
    data-slot="chat-layout"
  >
    <div
      ref="messageViewport"
      class="min-h-0 overflow-y-auto overscroll-contain"
      data-slot="chat-messages"
    >
      <div class="mx-auto flex min-h-full w-full max-w-3xl flex-col pt-6 pb-[132px]">
        <div
          v-if="loading"
          class="flex flex-1 items-center justify-center text-sm text-muted-foreground"
        >
          正在读取消息…
        </div>
        <div
          v-else-if="timeline.messages.length === 0"
          class="flex flex-1 flex-col items-center justify-center text-center"
        >
          <p class="text-sm font-medium text-foreground">暂无消息</p>
          <p class="text-sm text-muted-foreground">发送一条消息开始会话。</p>
        </div>
        <MessageList v-else :messages="timeline.messages" />
      </div>
    </div>

    <div class="absolute bottom-0 z-10 w-full shrink-0 px-8 pb-2" data-slot="chat-composer">
      <div class="relative z-1 mx-auto w-full max-w-3xl">
        <slot />
      </div>
      <div class="absolute right-0 bottom-0 left-0 z-0 mx-2 h-10 bg-(--background)"></div>
    </div>
  </div>
</template>
