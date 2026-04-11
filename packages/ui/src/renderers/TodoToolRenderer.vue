<script setup lang="ts">
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import {
  CheckCircle2Icon,
  ChevronDown,
  CircleIcon,
  ListTodoIcon,
  LoaderIcon,
  XCircleIcon,
} from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";

interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
}

interface TodoToolDetails {
  todos?: TodoItem[];
}

const props = defineProps<{
  toolName?: string;
  params?: unknown;
  result?: ToolResultMessage<TodoToolDetails>;
  isStreaming?: boolean;
}>();

const open = ref(false);

const state = computed(() => {
  if (props.result) {
    return props.result.isError ? "error" : "completed";
  }
  return props.isStreaming ? "running" : "pending";
});

const todos = computed<TodoItem[]>(() => {
  const fromDetails = props.result?.details?.todos;
  if (Array.isArray(fromDetails)) {
    return fromDetails;
  }

  if (props.params && typeof props.params === "object" && "todos" in props.params) {
    const nextTodos = (props.params as { todos?: TodoItem[] }).todos;
    if (Array.isArray(nextTodos)) {
      return nextTodos;
    }
  }

  return [];
});

const completedCount = computed(
  () => todos.value.filter((todo) => todo.status === "completed").length,
);
const pendingCount = computed(() => todos.value.filter((todo) => todo.status === "pending").length);
const inProgressCount = computed(
  () => todos.value.filter((todo) => todo.status === "in_progress").length,
);
const currentTodo = computed(
  () => todos.value.find((todo) => todo.status === "in_progress") ?? null,
);

const titleText = computed(() => {
  if (props.toolName === "todoread") {
    return "读取待办列表";
  }
  if (props.toolName === "todowrite") {
    return "更新待办列表";
  }
  return "待办列表";
});

const summaryText = computed(() => {
  if (state.value === "running") {
    return currentTodo.value?.content ?? "正在处理待办列表…";
  }
  if (todos.value.length === 0) {
    return props.toolName === "todoread" ? "当前没有待办事项" : "待办列表为空";
  }
  return currentTodo.value?.content ?? `共 ${todos.value.length} 项待办`;
});

const statusText = computed(() => {
  if (state.value === "running") {
    return "进行中";
  }
  if (state.value === "error") {
    return "失败";
  }
  if (state.value === "pending") {
    return "等待中";
  }
  return "已完成";
});

const progressText = computed(() => {
  if (todos.value.length === 0) {
    return "0 项";
  }
  return `${completedCount.value}/${todos.value.length}`;
});

const hasDetails = computed(() => todos.value.length > 0);

const statusConfig = {
  completed: { icon: CheckCircle2Icon, class: "text-emerald-500" },
  in_progress: { icon: LoaderIcon, class: "text-blue-500 animate-spin" },
  pending: { icon: CircleIcon, class: "text-muted-foreground/50" },
  cancelled: { icon: XCircleIcon, class: "text-destructive/60" },
} as const;

watch(
  () => state.value,
  (nextState) => {
    if (nextState === "running") {
      open.value = false;
    }
  },
  { immediate: true },
);

function handleOpenChange(nextOpen: boolean) {
  if (!hasDetails.value || state.value === "running") {
    open.value = false;
    return;
  }
  open.value = nextOpen;
}
</script>

<template>
  <Collapsible :open="open" @update:open="handleOpenChange">
    <div class="rounded-lg border border-border bg-card px-3 py-2 text-card-foreground">
      <CollapsibleTrigger
        class="flex w-full items-start justify-between gap-3 text-left disabled:pointer-events-none"
        :disabled="!hasDetails || state === 'running'"
      >
        <div class="min-w-0 flex-1 space-y-2">
          <div class="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <ListTodoIcon class="size-3.5 shrink-0" />
            <span class="truncate">{{ titleText }}</span>
            <span
              class="inline-flex shrink-0 items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] leading-none"
            >
              {{ statusText }}
            </span>
          </div>

          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-1">
              <p class="truncate text-sm font-medium text-foreground">
                {{ summaryText }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ progressText }}
                <template v-if="inProgressCount > 0"> · {{ inProgressCount }} 项进行中</template>
                <template v-if="pendingCount > 0"> · {{ pendingCount }} 项待处理</template>
              </p>
            </div>

            <ChevronDown
              v-if="hasDetails"
              class="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform"
              :class="{ 'rotate-180': open }"
            />
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent v-if="hasDetails" class="mt-3 border-t border-border/60 pt-3">
        <ul class="flex flex-col gap-2">
          <li
            v-for="todo in todos"
            :key="todo.id"
            class="flex items-start gap-2 rounded-md px-1 py-0.5 text-sm"
          >
            <component
              :is="statusConfig[todo.status].icon"
              class="mt-0.5 size-4 shrink-0"
              :class="statusConfig[todo.status].class"
            />
            <span
              class="leading-6"
              :class="{
                'text-muted-foreground line-through':
                  todo.status === 'completed' || todo.status === 'cancelled',
                'font-medium text-foreground': todo.status === 'in_progress',
              }"
            >
              {{ todo.content }}
            </span>
          </li>
        </ul>
      </CollapsibleContent>
    </div>
  </Collapsible>
</template>
