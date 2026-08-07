<script setup lang="ts">
import type { SkillInfo, WorkspaceFilesChangedEvent } from "@shared/api";
import { WORKSPACE_FILES_CHANGED_EVENT } from "@shared/constants";
import { Button } from "@willow/shadcn/components/ui/button";
import { Kanban, RefreshCw } from "lucide-vue-next";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { ComposerPromptTemplate } from "@/components/prompt-composer";
import { useEventBus } from "@/composables/useEventBus";
import { electronAPI } from "@/lib/ipc";
import type { BoardPanelState } from "./types";

const props = defineProps<{
  workspaceId?: number;
  tabId: string;
  state: BoardPanelState;
}>();

const emit = defineEmits<{
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
let disposed = false;
let generation = 0;
let subscribedWorkspaceId: number | undefined;
let switchPromise = Promise.resolve();

const iframeUrl = computed(() =>
  panelUrl.value ? `${panelUrl.value}?v=${reloadVersion.value}` : "",
);

async function loadBoard(workspaceId: number, currentGeneration: number): Promise<void> {
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
        }
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
  removeEventListener(WORKSPACE_FILES_CHANGED_EVENT, handleWorkspaceFilesChanged);
  if (subscribedWorkspaceId !== undefined) {
    void electronAPI.unsubscribeWorkspaceFiles({ subscriptionId: props.tabId });
  }
});
</script>

<template>
  <section
    class="flex h-full min-h-0 min-w-0 flex-col bg-background p-2"
    data-slot="right-sidebar-board-panel"
    :data-tab-id="tabId"
    :data-workspace-id="workspaceId"
  >
    <iframe
      v-if="status === 'ready'"
      :key="iframeUrl"
      :src="iframeUrl"
      class="h-full min-h-0 w-full rounded-xl border-0 bg-background"
      data-slot="board-panel-frame"
      sandbox="allow-scripts allow-same-origin"
      title="项目看板"
    />

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
