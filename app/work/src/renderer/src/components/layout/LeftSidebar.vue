<script setup lang="ts">
import { ref, nextTick, onMounted } from "vue";
import { SquarePen, Settings, Ellipsis, Pencil, Trash2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useChatStore } from "@/stores/chat";

defineProps<{
  isCollapsed: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle-sidebar"): void;
  (e: "open-settings"): void;
}>();

const chatStore = useChatStore();

onMounted(() => {
  chatStore.loadSessions();
});

function handleNewChat() {
  chatStore.startDraftSession();
}

function handleSelectSession(sessionId: string) {
  chatStore.selectSession(sessionId);
}

// ─── 删除确认 ────────────────────────────────────────
const deleteDialogOpen = ref(false);
const pendingDeleteId = ref<string | null>(null);

function openDeleteDialog(sessionId: string) {
  pendingDeleteId.value = sessionId;
  deleteDialogOpen.value = true;
}

async function confirmDelete() {
  if (pendingDeleteId.value) {
    await chatStore.deleteSession(pendingDeleteId.value);
  }
  deleteDialogOpen.value = false;
  pendingDeleteId.value = null;
}

// ─── 重命名 ──────────────────────────────────────────
const renameDialogOpen = ref(false);
const pendingRenameId = ref<string | null>(null);
const renameInput = ref("");
const renameInputRef = ref<InstanceType<typeof Input> | null>(null);

function openRenameDialog(sessionId: string, currentTitle: string) {
  pendingRenameId.value = sessionId;
  renameInput.value = currentTitle;
  renameDialogOpen.value = true;
  nextTick(() => {
    const el = renameInputRef.value?.$el as HTMLInputElement | undefined;
    el?.focus();
    el?.select();
  });
}

async function confirmRename() {
  const title = renameInput.value.trim();
  if (pendingRenameId.value && title) {
    await chatStore.renameSession(pendingRenameId.value, title);
  }
  renameDialogOpen.value = false;
  pendingRenameId.value = null;
  renameInput.value = "";
}

function handleRenameKeyDown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    confirmRename();
  }
}
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <aside class="flex h-full flex-col" role="complementary">
      <!-- macOS traffic lights 预留空间 -->
      <div class="drag-region h-[40px]" />

      <!-- 新建对话按钮 -->
      <div class="flex shrink-0 items-center px-2 py-1 justify-center">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="default"
              size="icon-sm"
              aria-label="新建对话"
              class="justify-center gap-2 transition-[width] duration-200 ease-in-out"
              :style="{ width: isCollapsed ? '32px' : '100%' }"
              @click="handleNewChat"
            >
              <SquarePen
                class="size-4 transition-[margin-left] duration-200 ease-in-out"
                :style="{ marginLeft: isCollapsed ? '8px' : '0px' }"
                aria-hidden="true"
              />
              <span class="text-xs overflow-hidden">新建对话</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" :side-offset="4" :avoid-collisions="false">
            新建对话
          </TooltipContent>
        </Tooltip>
      </div>

      <!-- 对话列表 -->
      <nav
        class="flex-1 overflow-y-auto px-2 py-1"
        aria-label="对话列表"
        :class="isCollapsed ? 'justify-center' : 'justify-between'"
      >
        <div class="space-y-0.5">
          <template v-if="!isCollapsed">
            <div
              v-for="item in chatStore.sessions"
              :key="item.id"
              class="group relative flex w-full items-center rounded-md transition-colors"
              :class="
                !chatStore.isDraftSession && chatStore.currentSessionId === item.id
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              "
            >
              <!-- 会话标题按钮 -->
              <button
                class="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm focus-visible:outline-none"
                :class="
                  !chatStore.isDraftSession && chatStore.currentSessionId === item.id
                    ? 'font-medium'
                    : ''
                "
                @click="handleSelectSession(item.id)"
              >
                <span class="min-w-0 truncate">{{ item.title || '新对话' }}</span>
              </button>

              <!-- 更多菜单按钮（hover 时显示） -->
              <div
                class="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100"
                :class="{
                  'opacity-100': !chatStore.isDraftSession && chatStore.currentSessionId === item.id,
                }"
              >
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="size-6 text-muted-foreground hover:text-foreground"
                      aria-label="更多操作"
                      @click.stop
                    >
                      <Ellipsis class="size-3.5" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" :side-offset="4" class="w-36">
                    <DropdownMenuItem
                      class="gap-2"
                      @click="openRenameDialog(item.id, item.title || '新对话')"
                    >
                      <Pencil class="size-3.5" aria-hidden="true" />
                      重命名
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      class="gap-2 text-destructive focus:text-destructive"
                      @click="openDeleteDialog(item.id)"
                    >
                      <Trash2 class="size-3.5" aria-hidden="true" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </template>
        </div>
      </nav>

      <!-- 底部区域 -->
      <div class="shrink-0">
        <div class="flex items-center px-2 py-2" :class="isCollapsed ? 'justify-center' : 'justify-between'">
          <!-- 设置按钮 -->
          <Button variant="ghost" size="icon-sm" class="text-muted-foreground hover:text-foreground" aria-label="设置"
            @click="emit('open-settings')">
            <Settings class="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </aside>

    <!-- 删除确认对话框 -->
    <AlertDialog v-model:open="deleteDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>
            删除后将永久移除该对话及其所有消息记录，此操作无法撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <Button
            variant="destructive"
            @click="confirmDelete"
          >
            删除
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- 重命名对话框 -->
    <Dialog v-model:open="renameDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>重命名对话</DialogTitle>
          <DialogDescription>
            输入新的对话标题
          </DialogDescription>
        </DialogHeader>
        <div class="py-4">
          <Input
            ref="renameInputRef"
            v-model="renameInput"
            placeholder="输入新标题…"
            @keydown="handleRenameKeyDown"
          />
        </div>
        <DialogFooter>
          <DialogClose as-child>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button
            :disabled="!renameInput.trim()"
            @click="confirmRename"
          >
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </TooltipProvider>
</template>
