<script setup lang="ts">
import type { MemoryFileRequest, WorkspaceInfo } from "@shared/api";
import type { MemorySnapshot } from "@willow/core";
import { Button } from "@willow/shadcn/components/ui/button";
import { Switch } from "@willow/shadcn/components/ui/switch";
import { RefreshCw } from "lucide-vue-next";
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { electronAPI } from "@/lib/ipc";

interface TabState {
  memory?: MemorySnapshot;
  loading: boolean;
  editing: boolean;
  saving: boolean;
  draft: string;
  error: string;
  notice: string;
  generation: number;
}
const memoryEnabled = ref(true);
const loadingEnabled = ref(true);
const savingEnabled = ref(false);
const enabledError = ref("");
const workspaces = ref<WorkspaceInfo[]>([]);
const activeKey = ref("global");
const workspaceError = ref("");
const editor = ref<HTMLTextAreaElement>();
const states = reactive<Record<string, TabState>>({});
const tabs = computed(() => [
  { key: "global", name: "全局记忆", request: { scope: "global" } as MemoryFileRequest },
  ...workspaces.value.map((workspace) => ({
    key: `project:${workspace.id}`,
    name: workspace.name,
    request: { scope: "project", workspaceId: workspace.id } as MemoryFileRequest,
  })),
]);
const activeTab = computed(() => tabs.value.find((tab) => tab.key === activeKey.value)!);
const editorLabel = computed(() =>
  activeKey.value === "global" ? "编辑全局记忆" : `编辑${activeTab.value.name}的记忆`,
);
const state = computed(() => stateFor(activeKey.value));
const draftBytes = computed(() => new TextEncoder().encode(state.value.draft).length);
let disposed = false;
function stateFor(key: string) {
  states[key] ??= {
    loading: false,
    editing: false,
    saving: false,
    draft: "",
    error: "",
    notice: "",
    generation: 0,
  };
  return states[key]!;
}
function message(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请重试。";
}
async function refresh() {
  const tab = activeTab.value;
  const target = stateFor(tab.key);
  if (target.editing || target.saving) return;
  const generation = ++target.generation;
  target.loading = true;
  target.error = "";
  try {
    const { memory } = await electronAPI.readMemory(tab.request);
    if (!disposed && generation === target.generation) target.memory = memory;
  } catch (error) {
    if (!disposed && generation === target.generation) target.error = message(error);
  } finally {
    if (!disposed && generation === target.generation) target.loading = false;
  }
}
function selectTab(key: string) {
  activeKey.value = key;
  void refresh();
}
async function beginEdit() {
  const target = state.value;
  if (!target.memory || target.loading || target.saving) return;
  target.generation++;
  target.draft = target.memory.content;
  target.editing = true;
  target.error = "";
  target.notice = "";
  await nextTick();
  editor.value?.focus();
}
function cancel() {
  state.value.editing = false;
  state.value.draft = "";
  void refresh();
}
async function save() {
  const tab = activeTab.value;
  const target = state.value;
  if (!target.memory || target.saving) return;
  target.saving = true;
  target.error = "";
  try {
    const { memory } = await electronAPI.saveMemory({
      ...tab.request,
      content: target.draft,
      expectedContent: target.memory.exists ? target.memory.content : null,
    });
    if (disposed) return;
    target.memory = memory;
    target.editing = false;
    target.notice = "已保存，下次对话时生效。";
  } catch (error) {
    if (!disposed) target.error = message(error);
  } finally {
    if (!disposed) target.saving = false;
  }
}
async function loadEnabled() {
  loadingEnabled.value = true;
  try {
    const { memory } = await electronAPI.readMemory({ scope: "global" });
    if (!disposed && !savingEnabled.value) memoryEnabled.value = memory.enabled;
  } catch (error) {
    if (!disposed) enabledError.value = message(error);
  } finally {
    if (!disposed) loadingEnabled.value = false;
  }
}
async function toggleMemory(enabled: boolean) {
  if (savingEnabled.value || loadingEnabled.value) return;
  savingEnabled.value = true;
  enabledError.value = "";
  try {
    const result = await electronAPI.setMemoryEnabled({ enabled });
    if (!disposed) {
      memoryEnabled.value = result.enabled;
      void refresh();
    }
  } catch (error) {
    if (!disposed) enabledError.value = message(error);
  } finally {
    if (!disposed) savingEnabled.value = false;
  }
}
function onFocus() {
  if (!savingEnabled.value) void loadEnabled();
  void refresh();
}
onMounted(async () => {
  window.addEventListener("focus", onFocus);
  void loadEnabled();
  void refresh();
  try {
    const lists = await Promise.all([
      electronAPI.getWorkspaceList({ pinned: true }),
      electronAPI.getWorkspaceList({ pinned: false }),
    ]);
    if (!disposed) workspaces.value = lists.flatMap((list) => list.workspaces);
  } catch {
    if (!disposed) workspaceError.value = "无法加载工作空间，请重新打开记忆设置。";
  }
});
onBeforeUnmount(() => {
  disposed = true;
  window.removeEventListener("focus", onFocus);
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col pr-2">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold">记忆</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          记住重要信息，让 Willow 更懂你的偏好和工作方式
        </p>
      </div>
      <Button variant="ghost" size="sm" :disabled="state.loading || state.editing" @click="refresh">
        <RefreshCw class="size-3.5" />刷新
      </Button>
    </div>
    <div class="mt-5 flex shrink-0 items-center justify-between gap-4">
      <div>
        <label for="memory-enabled" class="text-sm font-medium">启用记忆</label>
        <p class="mt-1 text-xs text-muted-foreground">
          关闭后，对话不加载记忆，Agent 不提供记忆更新工具。
        </p>
      </div>
      <Switch
        id="memory-enabled"
        :model-value="memoryEnabled"
        :disabled="loadingEnabled || savingEnabled"
        @update:model-value="toggleMemory"
      />
    </div>
    <p v-if="enabledError" role="alert" class="mt-2 text-xs text-destructive">{{ enabledError }}</p>
    <div role="tablist" aria-label="记忆范围" class="mt-7 flex shrink-0 gap-6 overflow-x-auto">
      <button
        v-for="tab in tabs"
        :id="`memory-tab-${tab.key}`"
        :key="tab.key"
        role="tab"
        :aria-selected="activeKey === tab.key"
        aria-controls="memory-panel"
        class="relative shrink-0 pb-3 text-sm transition-colors"
        :class="
          activeKey === tab.key
            ? 'font-semibold text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground'
            : 'text-muted-foreground hover:text-foreground'
        "
        @click="selectTab(tab.key)"
      >
        {{ tab.name }}
      </button>
    </div>
    <p v-if="workspaceError" role="alert" class="mt-3 text-xs text-destructive">
      {{ workspaceError }}
    </p>
    <div
      id="memory-panel"
      role="tabpanel"
      :aria-labelledby="`memory-tab-${activeKey}`"
      class="mt-4 flex min-h-0 flex-1 flex-col rounded-xl border bg-background"
      :class="state.editing ? 'border-primary ring-1 ring-primary' : ''"
    >
      <template v-if="state.editing">
        <textarea
          ref="editor"
          v-model="state.draft"
          :aria-label="editorLabel"
          :disabled="state.saving"
          placeholder="写下你希望 Willow 记住的信息…"
          class="min-h-40 w-full flex-1 resize-none rounded-t-xl bg-transparent p-4 text-sm leading-7 outline-none placeholder:text-muted-foreground"
        />
        <div class="flex items-center justify-between gap-3 px-4 pb-4">
          <span
            class="text-xs text-muted-foreground"
            :class="draftBytes > (state.memory?.maxBytes ?? 16384) ? 'text-destructive' : ''"
          >
            {{ (draftBytes / 1024).toFixed(1) }} /
            {{ ((state.memory?.maxBytes ?? 16384) / 1024).toFixed(1) }} KiB
          </span>
          <div class="flex gap-2">
            <Button variant="outline" size="sm" :disabled="state.saving" @click="cancel"
              >取消</Button
            >
            <Button
              size="sm"
              :disabled="state.saving || draftBytes > (state.memory?.maxBytes ?? 16384)"
              @click="save"
              >{{ state.saving ? "保存中…" : "保存" }}</Button
            >
          </div>
        </div>
      </template>
      <div
        v-else
        role="button"
        tabindex="0"
        :aria-label="editorLabel"
        :aria-disabled="state.loading || !state.memory"
        class="min-h-40 flex-1 cursor-text overflow-y-auto rounded-xl p-4 text-sm leading-7 whitespace-pre-wrap outline-none focus-visible:ring-2 focus-visible:ring-primary"
        @click="beginEdit"
        @keydown.enter.prevent="beginEdit"
        @keydown.space.prevent="beginEdit"
      >
        <span v-if="state.loading" role="status" class="text-muted-foreground">正在读取记忆…</span>
        <span v-else-if="state.memory?.content">{{ state.memory.content }}</span>
        <span v-else class="text-muted-foreground">{{
          activeKey === "global"
            ? "写下你希望 Willow 记住的信息…\n\n称呼：你希望如何被称呼\n风格：你喜欢的回答方式\n协作规则：工作中的偏好和约定\n背景：你的角色和关注的方向"
            : "写下这个工作空间的背景、架构和协作约定…"
        }}</span>
      </div>
    </div>
    <p
      v-if="state.error || state.memory?.error"
      role="alert"
      class="mt-3 text-xs break-words text-destructive"
    >
      {{ state.error || state.memory?.error }}
    </p>
    <p v-else-if="state.notice" role="status" class="mt-3 text-xs text-muted-foreground">
      {{ state.notice }}
    </p>
  </div>
</template>
