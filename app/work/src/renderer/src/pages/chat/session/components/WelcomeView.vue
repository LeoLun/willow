<script setup lang="ts">
import { Separator } from "@willow/shadcn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@willow/shadcn/components/ui/dropdown-menu";
import { Folder, MessageSquare, ChevronDown, Compass, CornerDownLeft } from "lucide-vue-next";
import { useDialog } from "../../../../layout/dialog";
import GuideDialog from "./GuideDialog.vue";

interface WorkspaceLike {
  id: number;
  name: string;
}

const props = withDefaults(
  defineProps<{
    currentWorkspaceName?: string;
    chatScope?: "conversation" | "workspace";
    workspaces?: WorkspaceLike[];
  }>(),
  {
    currentWorkspaceName: "对话",
    chatScope: "conversation",
    workspaces: () => [],
  },
);

const emit = defineEmits<{
  (e: "create-workspace"): void;
  (e: "go-to-settings"): void;
  (e: "select-workspace", id: number): void;
}>();

const { openDialog } = useDialog();

function selectPrompt(text: string) {
  window.dispatchEvent(new CustomEvent("insert-prompt", { detail: text }));
}

function openGuide() {
  openDialog(
    GuideDialog,
    {
      onCreateWorkspace: () => emit("create-workspace"),
      onGoToSettings: () => emit("go-to-settings"),
    },
    {
      contentClass: "sm:max-w-2xl",
    },
  );
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center px-4 py-8">
    <div class="relative flex w-full max-w-2xl flex-col items-center">
      <!-- Welcome Guide Phrase -->
      <h2
        class="absolute top-[-70px] text-3xl font-semibold tracking-tight text-foreground select-none"
      >
        今天想完成什么任务？
      </h2>

      <!-- Centered Sender Input Box Slot -->
      <div class="w-full">
        <slot name="sender" />
      </div>

      <!-- Bottom Option Bar -->
      <div class="mt-4 flex w-full items-center justify-between px-2 text-xs text-muted-foreground">
        <!-- Left option: Workspace / Context Selector -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button
              class="flex cursor-pointer items-center gap-1.5 outline-none hover:text-foreground"
            >
              <MessageSquare
                v-slot="icon"
                v-if="props.chatScope === 'conversation'"
                class="size-3.5 text-emerald-400"
              />
              <Folder v-else class="size-3.5 text-indigo-400" />
              <span class="font-semibold text-foreground">
                {{ props.chatScope === "conversation" ? "对话" : props.currentWorkspaceName }}
              </span>
              <ChevronDown class="size-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="text-xs [--radius:0.75rem]">
            <DropdownMenuItem class="cursor-pointer gap-1.5" @click="emit('select-workspace', -1)">
              <MessageSquare class="size-3.5 text-emerald-400" />
              <span>对话</span>
            </DropdownMenuItem>

            <template v-if="props.workspaces.length > 0">
              <DropdownMenuSeparator />
              <DropdownMenuItem
                v-for="ws in props.workspaces"
                :key="ws.id"
                class="cursor-pointer gap-1.5"
                @click="emit('select-workspace', ws.id)"
              >
                <Folder class="size-3.5 text-indigo-400" />
                <span>{{ ws.name }}</span>
              </DropdownMenuItem>
            </template>
          </DropdownMenuContent>
        </DropdownMenu>

        <!-- Right: Guide trigger button -->
        <button
          class="flex cursor-pointer items-center gap-1 font-medium transition-colors outline-none hover:text-primary"
          @click="openGuide"
        >
          <Compass class="size-3.5" />
          <span>配置与使用指引</span>
        </button>
      </div>
    </div>
  </div>
</template>
