import type { TodoItem } from "@shared/api";
import { TODO_UPDATED } from "@shared/constants";
import { computed, onMounted, onUnmounted, reactive, watch, type Ref } from "vue";
import { useEventBus } from "./useEventBus";

interface TodoProgressState {
  todos: TodoItem[];
}

interface TodoUpdatedPayload {
  sessionId: number;
  todos: TodoItem[];
}

export function useTodoProgress(sessionId: Ref<number>) {
  const state = reactive<TodoProgressState>({
    todos: [],
  });

  const { addEventListener, removeEventListener } = useEventBus();

  const hasTodos = computed(() => state.todos.length > 0);

  const currentTodo = computed(() => state.todos.find((t) => t.status === "in_progress") ?? null);

  const completedCount = computed(() => state.todos.filter((t) => t.status === "completed").length);

  const totalCount = computed(() => state.todos.length);

  const hasActiveTodos = computed(() =>
    state.todos.some((t) => t.status === "pending" || t.status === "in_progress"),
  );

  function handleTodoUpdated(data: TodoUpdatedPayload) {
    if (data.sessionId !== sessionId.value) return;
    state.todos = data.todos;
  }

  function restoreFromActiveStream(todos?: TodoItem[]) {
    if (todos && todos.length > 0) {
      state.todos = todos;
    }
  }

  function reset() {
    state.todos = [];
  }

  watch(sessionId, () => {
    reset();
  });

  onMounted(() => {
    addEventListener(TODO_UPDATED, handleTodoUpdated);
  });

  onUnmounted(() => {
    removeEventListener(TODO_UPDATED, handleTodoUpdated);
  });

  return {
    todos: computed(() => state.todos),
    hasTodos,
    currentTodo,
    completedCount,
    totalCount,
    hasActiveTodos,
    restoreFromActiveStream,
  };
}
