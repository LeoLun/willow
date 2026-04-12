<script setup lang="ts">
import type { TodoItem } from "@shared/api";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@willow/shadcn/components/ui/collapsible";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  CircleIcon,
  ListTodoIcon,
  LoaderIcon,
  XCircleIcon,
} from "lucide-vue-next";
import { computed, ref } from "vue";

const props = defineProps<{
  todos: TodoItem[];
}>();

const isExpanded = ref(false);

const completedCount = computed(() => props.todos.filter((t) => t.status === "completed").length);

const currentTodo = computed(() => props.todos.find((t) => t.status === "in_progress") ?? null);

const statusConfig = {
  completed: { icon: CheckCircle2Icon, class: "text-emerald-500" },
  in_progress: { icon: LoaderIcon, class: "text-blue-500 animate-spin" },
  pending: { icon: CircleIcon, class: "text-muted-foreground/50" },
  cancelled: { icon: XCircleIcon, class: "text-destructive/60" },
} as const;
</script>

<template>
  <Collapsible v-model:open="isExpanded">
    <div class="rounded-lg border border-border/60 bg-background/80 shadow-sm backdrop-blur-md">
      <CollapsibleTrigger class="flex w-full cursor-pointer items-center gap-2 px-3 py-2">
        <ListTodoIcon class="size-3.5 shrink-0 text-muted-foreground" />
        <component
          v-if="currentTodo"
          :is="statusConfig[currentTodo.status].icon"
          class="mt-0.5 size-3.5 shrink-0"
          :class="statusConfig[currentTodo.status].class"
        />
        <span class="min-w-0 flex-1 truncate text-left text-xs">
          <template v-if="currentTodo">
            {{ currentTodo.content }}
          </template>
          <template v-else> 任务列表 </template>
        </span>
        <span class="shrink-0 text-xs text-muted-foreground tabular-nums">
          {{ completedCount }}/{{ todos.length }}
        </span>
        <ChevronUpIcon v-if="isExpanded" class="size-3.5 shrink-0 text-muted-foreground" />
        <ChevronDownIcon v-else class="size-3.5 shrink-0 text-muted-foreground" />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div class="border-t border-border/40 px-3 py-2">
          <ul class="flex flex-col gap-1">
            <li v-for="todo in todos" :key="todo.id" class="flex items-start gap-2 text-xs">
              <component
                :is="statusConfig[todo.status].icon"
                class="mt-0.5 size-3.5 shrink-0"
                :class="statusConfig[todo.status].class"
              />
              <span
                :class="{
                  'text-muted-foreground line-through':
                    todo.status === 'completed' || todo.status === 'cancelled',
                  'font-medium': todo.status === 'in_progress',
                }"
              >
                {{ todo.content }}
              </span>
            </li>
          </ul>
        </div>
      </CollapsibleContent>
    </div>
  </Collapsible>
</template>
