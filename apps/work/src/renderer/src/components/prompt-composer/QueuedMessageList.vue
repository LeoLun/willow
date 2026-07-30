<script setup lang="ts">
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@willow/shadcn/components/ui/collapsible";
import { ChevronDownIcon, Trash2Icon } from "lucide-vue-next";
import { ref } from "vue";
import type { QueuedMessage } from "@/composables/useMessageQueue";

interface Props {
  messages: readonly QueuedMessage[];
}

const props = defineProps<Props>();
const open = ref(true);

const emit = defineEmits<{
  remove: [messageId: string];
}>();
</script>

<template>
  <Collapsible
    v-model:open="open"
    class="mb-2 overflow-hidden rounded-[1.75rem] border border-sidebar-border bg-background/95 shadow-lg"
    :class="open ? 'py-3' : 'py-1.5'"
    data-slot="queued-message-list"
  >
    <CollapsibleTrigger as-child>
      <button
        type="button"
        class="flex w-full cursor-pointer items-center px-4 text-left"
        :aria-label="`${open ? '收起' : '展开'}排队消息`"
      >
        <span class="flex min-w-0 flex-1 items-center gap-2">
          <span class="shrink-0 text-xs font-medium text-foreground">排队消息</span>
          <span
            class="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs leading-5 font-medium text-muted-foreground tabular-nums"
          >
            {{ props.messages.length }}
          </span>
          <span class="truncate text-xs text-muted-foreground">将在当前任务完成后发送</span>
        </span>
        <ChevronDownIcon
          class="mr-2 size-4 shrink-0 text-muted-foreground transition-transform duration-200"
          :class="open ? '' : '-rotate-90'"
          aria-hidden="true"
        />
      </button>
    </CollapsibleTrigger>

    <CollapsibleContent>
      <div class="max-h-40 overflow-y-auto px-4">
        <div
          v-for="message in props.messages"
          :key="message.id"
          class="group mt-1 flex h-7 min-w-0 items-center justify-between gap-2"
          data-slot="queued-message"
        >
          <p
            class="line-clamp-2 min-w-0 flex-1 text-sm leading-6 break-words"
            :title="message.payload.content"
          >
            {{ message.payload.content }}
          </p>
          <button
            type="button"
            class="inline-flex size-7 shrink-0 items-center justify-center rounded-3xl text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
            :aria-label="`删除排队消息：${message.payload.content}`"
            @click="emit('remove', message.id)"
          >
            <Trash2Icon class="size-3" aria-hidden="true" />
          </button>
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
