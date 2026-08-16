<script setup lang="ts">
import type { SkillInfo, WorkspaceFilesChangedEvent } from "@shared/api";
import { WORKSPACE_FILES_CHANGED_EVENT } from "@shared/constants";
import { Button } from "@willow/shadcn/components/ui/button";
import {
  ExternalLink,
  Kanban,
  Maximize2,
  Minimize2,
  MousePointer2,
  Plus,
  RefreshCw,
} from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import {
  serializeBoardNodeReference,
  type BoardNodeReference,
  type ComposerPromptTemplate,
} from "@/components/prompt-composer";
import { useEventBus } from "@/composables/useEventBus";
import { electronAPI } from "@/lib/ipc";
import type { BoardPanelState } from "./types";

const props = defineProps<{
  workspaceId?: number;
  tabId: string;
  state: BoardPanelState;
}>();

const emit = defineEmits<{
  "insert-board-node": [source: string];
  "select-skill": [skill: SkillInfo, template: ComposerPromptTemplate];
}>();

const BOARD_STYLE_OPTIONS = ["Airbnb", "Cursor", "Claude", "Apple"].map((style) => ({
  label: style,
  value: style,
}));

const { addEventListener, removeEventListener, waitUntilReady } = useEventBus();
const status = ref<"error" | "loading" | "missing" | "ready">("loading");
const panelUrl = ref("");
const loadError = ref("");
const selectingSkill = ref(false);
const skillError = ref("");
const reloadVersion = ref(0);
const panel = shallowRef<HTMLElement>();
const frame = shallowRef<HTMLIFrameElement>();
const editing = ref(false);
const editError = ref("");
const isFullscreen = ref(false);
const openingExternal = ref(false);
const selectedNode = shallowRef<BoardNodeReference>();
const addButtonPosition = ref({ left: 0, top: 0 });
let disposed = false;
let generation = 0;
let editRequestGeneration = 0;
let editingWorkspaceId: number | undefined;
let subscribedWorkspaceId: number | undefined;
let switchPromise = Promise.resolve();

const iframeUrl = computed(() => {
  if (!panelUrl.value) return "";
  const url = new URL(panelUrl.value);
  url.searchParams.set("v", String(reloadVersion.value));
  url.searchParams.set("willow-board-tab", props.tabId);
  return url.toString();
});

function isBoardNodeReference(value: unknown): value is BoardNodeReference {
  if (!value || typeof value !== "object") return false;
  const reference = value as Partial<Record<keyof BoardNodeReference, unknown>>;
  return (
    reference.path === ".agents/panel/index.html" &&
    typeof reference.selector === "string" &&
    reference.selector.length <= 2_000 &&
    typeof reference.tag === "string" &&
    reference.tag.length <= 64 &&
    typeof reference.label === "string" &&
    reference.label.length <= 200 &&
    typeof reference.summary === "string" &&
    reference.summary.length <= 1_000
  );
}

function clearSelectedNode(): void {
  selectedNode.value = undefined;
}

function handleEditorMessage(event: MessageEvent): void {
  if (!editing.value || event.source !== frame.value?.contentWindow) return;
  if (!event.data || typeof event.data !== "object") return;
  const data = event.data as {
    channel?: unknown;
    tabId?: unknown;
    type?: unknown;
    rect?: { right?: unknown; top?: unknown };
    reference?: unknown;
  };
  if (data.channel !== "willow-board-editor" || data.tabId !== props.tabId) return;
  if (data.type === "exit") {
    void exitEditing();
    return;
  }
  if (data.type === "cleared") {
    clearSelectedNode();
    return;
  }
  if (
    data.type !== "selected" ||
    !isBoardNodeReference(data.reference) ||
    typeof data.rect?.right !== "number" ||
    typeof data.rect.top !== "number"
  ) {
    return;
  }
  const iframe = frame.value;
  if (!iframe) return;
  selectedNode.value = data.reference;
  addButtonPosition.value = {
    left: iframe.offsetLeft + Math.max(116, Math.min(data.rect.right - 4, iframe.clientWidth - 4)),
    top: iframe.offsetTop + Math.max(4, Math.min(data.rect.top + 4, iframe.clientHeight - 36)),
  };
}

async function enableEditorBridge(): Promise<void> {
  const workspaceId = props.workspaceId;
  if (!workspaceId || !editing.value) return;
  const requestGeneration = editRequestGeneration;
  try {
    await electronAPI.setBoardEditMode({
      enabled: true,
      tabId: props.tabId,
      workspaceId,
    });
  } catch (error) {
    if (disposed || requestGeneration !== editRequestGeneration) return;
    editing.value = false;
    editingWorkspaceId = undefined;
    clearSelectedNode();
    editError.value = error instanceof Error ? error.message : "无法开启看板编辑模式";
  }
}

function handleFrameLoad(): void {
  clearSelectedNode();
  if (editing.value) void enableEditorBridge();
}

async function enterEditing(): Promise<void> {
  const workspaceId = props.workspaceId;
  if (!workspaceId || !frame.value) {
    editError.value = "看板尚未加载完成，请稍后重试";
    return;
  }
  editRequestGeneration += 1;
  editError.value = "";
  editing.value = true;
  editingWorkspaceId = workspaceId;
  await enableEditorBridge();
}

async function exitEditing(): Promise<void> {
  const workspaceId = editingWorkspaceId;
  editRequestGeneration += 1;
  editing.value = false;
  editingWorkspaceId = undefined;
  clearSelectedNode();
  if (!workspaceId) return;
  try {
    await electronAPI.setBoardEditMode({
      enabled: false,
      tabId: props.tabId,
      workspaceId,
    });
  } catch (error) {
    if (!disposed) console.error("关闭看板编辑模式失败:", error);
  }
}

function toggleEditing(): void {
  if (editing.value) void exitEditing();
  else void enterEditing();
}

function handleFullscreenChange(): void {
  isFullscreen.value = document.fullscreenElement === panel.value;
}

async function toggleFullscreen(): Promise<void> {
  const panelElement = panel.value;
  if (!panelElement) return;
  editError.value = "";
  try {
    if (document.fullscreenElement === panelElement) await document.exitFullscreen();
    else await panelElement.requestFullscreen();
  } catch (error) {
    editError.value = error instanceof Error ? error.message : "无法切换看板全屏状态";
  }
}

async function openInExternalApplication(): Promise<void> {
  const workspaceId = props.workspaceId;
  if (!workspaceId || openingExternal.value) return;
  openingExternal.value = true;
  editError.value = "";
  try {
    await electronAPI.openWorkspaceFile({
      workspaceId,
      relativePath: ".agents/panel/index.html",
    });
  } catch (error) {
    editError.value = error instanceof Error ? error.message : "无法使用外部应用打开看板";
  } finally {
    openingExternal.value = false;
  }
}

function addSelectedNodeToConversation(): void {
  const reference = selectedNode.value;
  if (!reference) return;
  emit("insert-board-node", serializeBoardNodeReference(reference));
  frame.value?.contentWindow?.postMessage(
    { channel: "willow-board-editor", tabId: props.tabId, type: "clear" },
    "*",
  );
  clearSelectedNode();
}

async function loadBoard(workspaceId: number, currentGeneration: number): Promise<void> {
  clearSelectedNode();
  try {
    const response = await electronAPI.getBoardPanel({ workspaceId });
    if (disposed || currentGeneration !== generation) return;
    if (response.status === "ready") {
      panelUrl.value = response.url;
      reloadVersion.value += 1;
      status.value = "ready";
    } else {
      panelUrl.value = "";
      status.value = "missing";
    }
  } catch (error) {
    if (disposed || currentGeneration !== generation) return;
    panelUrl.value = "";
    status.value = "error";
    loadError.value = error instanceof Error ? error.message : "无法读取看板";
  }
}

async function switchWorkspace(
  workspaceId: number | undefined,
  currentGeneration: number,
): Promise<void> {
  await exitEditing();
  if (subscribedWorkspaceId !== undefined) {
    await electronAPI.unsubscribeWorkspaceFiles({ subscriptionId: props.tabId });
    subscribedWorkspaceId = undefined;
  }
  if (disposed || currentGeneration !== generation) return;

  panelUrl.value = "";
  loadError.value = "";
  skillError.value = "";
  status.value = workspaceId ? "loading" : "missing";
  if (!workspaceId) return;

  await loadBoard(workspaceId, currentGeneration);
  try {
    await waitUntilReady();
    if (disposed || currentGeneration !== generation) return;
    await electronAPI.subscribeWorkspaceFiles({
      subscriptionId: props.tabId,
      workspaceId,
    });
    if (disposed || currentGeneration !== generation) {
      await electronAPI.unsubscribeWorkspaceFiles({ subscriptionId: props.tabId });
      return;
    }
    subscribedWorkspaceId = workspaceId;
  } catch (error) {
    if (!disposed && currentGeneration === generation) {
      console.error("订阅看板文件变化失败:", error);
    }
  }
}

function handleWorkspaceFilesChanged(payload: WorkspaceFilesChangedEvent): void {
  const workspaceId = props.workspaceId;
  if (
    !workspaceId ||
    payload.workspaceId !== workspaceId ||
    !payload.changes.some(
      ({ relativePath }) =>
        relativePath === ".agents/panel" || relativePath.startsWith(".agents/panel/"),
    )
  ) {
    return;
  }
  void loadBoard(workspaceId, generation);
}

async function selectCreateBoardSkill(): Promise<void> {
  const workspaceId = props.workspaceId;
  if (!workspaceId || selectingSkill.value) return;

  selectingSkill.value = true;
  skillError.value = "";
  try {
    const response = await electronAPI.getSkillList({ workspaceId });
    const skill = response.skills.find(
      (candidate) => candidate.source === "builtin" && candidate.name === "create-board",
    );
    if (!skill) {
      skillError.value = "“创建看板”技能不可用，请在技能设置中启用后重试。";
      return;
    }
    emit("select-skill", skill, {
      segments: [
        {
          type: "text",
          content: `[!${skill.name}](${skill.filePath}) 分析当前项目的内容与结构，生成适合该项目的看板，并按照 `,
        },
        {
          type: "select",
          placeholder: "选择风格",
          options: BOARD_STYLE_OPTIONS,
        },
        {
          type: "text",
          content: " 风格完成布局与视觉设计。",
        },
      ],
    });
  } catch (error) {
    skillError.value = error instanceof Error ? error.message : "无法读取技能列表，请重试。";
  } finally {
    selectingSkill.value = false;
  }
}

function retry(): void {
  const workspaceId = props.workspaceId;
  if (!workspaceId) return;
  status.value = "loading";
  loadError.value = "";
  void loadBoard(workspaceId, generation);
}

addEventListener(WORKSPACE_FILES_CHANGED_EVENT, handleWorkspaceFilesChanged);
onMounted(() => {
  window.addEventListener("message", handleEditorMessage);
  document.addEventListener("fullscreenchange", handleFullscreenChange);
});
watch(
  () => props.workspaceId,
  (workspaceId) => {
    const currentGeneration = ++generation;
    switchPromise = switchPromise.then(() => switchWorkspace(workspaceId, currentGeneration));
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  disposed = true;
  generation += 1;
  void exitEditing();
  window.removeEventListener("message", handleEditorMessage);
  document.removeEventListener("fullscreenchange", handleFullscreenChange);
  removeEventListener(WORKSPACE_FILES_CHANGED_EVENT, handleWorkspaceFilesChanged);
  if (subscribedWorkspaceId !== undefined) {
    void electronAPI.unsubscribeWorkspaceFiles({ subscriptionId: props.tabId });
  }
});
</script>

<template>
  <section
    ref="panel"
    class="relative flex h-full min-h-0 min-w-0 flex-col bg-background p-2"
    data-slot="right-sidebar-board-panel"
    :data-tab-id="tabId"
    :data-workspace-id="workspaceId"
  >
    <template v-if="status === 'ready'">
      <iframe
        :key="iframeUrl"
        ref="frame"
        :src="iframeUrl"
        class="h-full min-h-0 w-full rounded-xl border-0 bg-background"
        data-slot="board-panel-frame"
        sandbox="allow-scripts allow-same-origin"
        title="项目看板"
        @load="handleFrameLoad"
      />
      <div class="absolute top-4 right-4 z-20 flex items-center gap-1">
        <Button
          class="shadow-sm"
          :variant="editing ? 'default' : 'secondary'"
          size="icon-sm"
          :aria-label="editing ? '退出看板编辑' : '编辑看板'"
          :aria-pressed="editing"
          data-slot="board-edit-toggle"
          @click="toggleEditing"
        >
          <MousePointer2 aria-hidden="true" />
        </Button>
        <Button
          class="shadow-sm"
          variant="secondary"
          size="icon-sm"
          :aria-label="isFullscreen ? '取消全屏' : '全屏'"
          :aria-pressed="isFullscreen"
          data-slot="board-fullscreen-toggle"
          @click="toggleFullscreen"
        >
          <Minimize2 v-if="isFullscreen" aria-hidden="true" />
          <Maximize2 v-else aria-hidden="true" />
        </Button>
        <Button
          class="shadow-sm"
          variant="secondary"
          size="icon-sm"
          aria-label="使用外部应用打开看板"
          :disabled="openingExternal"
          data-slot="board-open-external"
          @click="openInExternalApplication"
        >
          <ExternalLink aria-hidden="true" />
        </Button>
      </div>
      <Button
        v-if="selectedNode"
        class="absolute z-20 -translate-x-full shadow-md"
        :style="{ left: `${addButtonPosition.left}px`, top: `${addButtonPosition.top}px` }"
        size="sm"
        data-slot="board-add-node"
        @click="addSelectedNodeToConversation"
      >
        <Plus aria-hidden="true" />
        添加到对话
      </Button>
      <p
        v-if="editError"
        class="text-destructive-foreground absolute right-4 bottom-4 left-4 z-20 rounded-lg bg-destructive px-3 py-2 text-xs shadow-md"
        role="alert"
      >
        {{ editError }}
      </p>
    </template>

    <div
      v-else
      class="flex min-h-0 flex-1 items-center justify-center p-6 text-center"
      data-slot="board-panel-empty"
    >
      <div class="flex max-w-xs flex-col items-center gap-3">
        <RefreshCw
          v-if="status === 'loading'"
          class="size-7 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
        <Kanban v-else class="size-8 text-muted-foreground" aria-hidden="true" />

        <template v-if="status === 'loading'">
          <p class="text-sm text-muted-foreground">正在检查项目看板…</p>
        </template>
        <template v-else-if="status === 'error'">
          <p class="text-sm font-medium">无法加载看板</p>
          <p class="text-xs text-destructive" role="alert">{{ loadError }}</p>
          <Button variant="outline" size="sm" @click="retry">重新检查</Button>
        </template>
        <template v-else>
          <div>
            <p class="text-sm font-medium">当前项目还没有看板</p>
            <p class="mt-1 text-xs leading-5 text-muted-foreground">
              创建项目概览并保存到 .agents/panel/index.html
            </p>
          </div>
          <Button
            size="sm"
            :disabled="!workspaceId || selectingSkill"
            @click="selectCreateBoardSkill"
          >
            {{ selectingSkill ? "正在选择…" : "创建看板" }}
          </Button>
          <p v-if="skillError" class="text-xs text-destructive" role="alert">
            {{ skillError }}
          </p>
        </template>
      </div>
    </div>
  </section>
</template>
