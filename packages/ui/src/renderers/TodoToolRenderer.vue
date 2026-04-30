<script setup lang="ts">
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { ListTodoIcon } from "lucide-vue-next";
import { computed } from "vue";
import ToolCallCard from "../components/ToolCallCard.vue";
import { i18n } from "../utils/i18n";

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

const state = computed(() => {
  if (props.result) return props.result.isError ? "error" : "completed";
  return props.isStreaming ? "running" : "pending";
});

const stateLabel = computed(() => {
  if (state.value === "error") return i18n("Error");
  if (state.value === "running") return i18n("Running");
  if (state.value === "pending") return i18n("Pending");
  return i18n("Completed");
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
const currentTodo = computed(
  () => todos.value.find((todo) => todo.status === "in_progress") ?? null,
);

const summaryText = computed(() => {
  return currentTodo.value?.content ?? `待办列表`;
});

const titleText = computed(() => {
  let parts = "";
  if (todos.value.length === 0) {
    parts = "0 项";
  } else {
    parts = `${completedCount.value}/${todos.value.length}`;
  }

  if (props.toolName === "todoread") {
    return "读取待办列表";
  }
  if (props.toolName === "todowrite") {
    return `更新 ${summaryText.value} 状态`;
  }
  return "待办列表";
});
</script>

<template>
  <ToolCallCard
    :title="titleText"
    :state-label="stateLabel"
    :can-expand="false"
    :error="state === 'error'"
    :loading="state === 'running' || state === 'pending'"
  >
    <template #icon>
      <ListTodoIcon class="size-3.5 shrink-0 text-muted-foreground" />
    </template>
  </ToolCallCard>
</template>
