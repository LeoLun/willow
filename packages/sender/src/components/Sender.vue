<script setup lang="ts">
import type { Editor as TiptapEditor } from "@tiptap/core";
import { Button } from "@willow/shadcn/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@willow/shadcn/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@willow/shadcn/components/ui/tooltip";
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  FileTextIcon,
  GlobeIcon,
  PlusIcon,
  SettingsIcon,
  SquareIcon,
} from "lucide-vue-next";
import { computed, ref, shallowRef, watch } from "vue";
import { useTriggerManager } from "../composables/useTriggerManager";
import type {
  SenderFileOption,
  SenderFileReference,
  SenderModelOption,
  SenderSendPayload,
  SenderSkillOption,
  SenderSkillReference,
  SenderUsageLike,
  SenderUsageMessage,
} from "../types";
import CircularProgress from "./CircularProgress.vue";
import Editor from "./Editor.vue";
import FilePickerPanel from "./FilePickerPanel.vue";
import SkillPickerPanel from "./SkillPickerPanel.vue";

const SKILL_TRIGGER = "/";
const FILE_TRIGGER = "@";

const props = withDefaults(
  defineProps<{
    messages?: SenderUsageMessage[];
    isStreaming?: boolean;
    streamMessage?: SenderUsageMessage | null;
    showUsage?: boolean;
    models?: SenderModelOption[];
    defaultModelId?: string;
    selectedModelId?: string;
    skills?: SenderSkillOption[];
    skillsLoading?: boolean;
    skillsErrorMessage?: string;
    files?: SenderFileOption[];
    filesLoading?: boolean;
    filesErrorMessage?: string;
    webSearchEnabled?: boolean;
  }>(),
  {
    messages: () => [],
    isStreaming: false,
    streamMessage: null,
    showUsage: true,
    models: () => [],
    defaultModelId: "",
    selectedModelId: "",
    skills: () => [],
    skillsLoading: false,
    skillsErrorMessage: "",
    files: () => [],
    filesLoading: false,
    filesErrorMessage: "",
    webSearchEnabled: true,
  },
);

const emit = defineEmits<{
  send: [request: SenderSendPayload];
  stop: [];
  "open-settings": [];
  "update:selectedModelId": [modelId: string];
  "update:webSearchEnabled": [enabled: boolean];
}>();

const showNoModelTip = ref(false);
const editorText = ref("");
const editorSkillKeys = ref<Set<string>>(new Set());
const editorFileKeys = ref<Set<string>>(new Set());
const localSelectedModelId = ref("");
const localWebSearchEnabled = ref(props.webSearchEnabled);
const editorComponentRef = ref<InstanceType<typeof Editor> | null>(null);
const skillPickerPanelRef = ref<InstanceType<typeof SkillPickerPanel> | null>(null);
const filePickerPanelRef = ref<InstanceType<typeof FilePickerPanel> | null>(null);
const tiptapEditor = shallowRef<TiptapEditor | undefined>();

const triggerManager = useTriggerManager(tiptapEditor, [
  { char: SKILL_TRIGGER, pattern: /(\/\S*)$/ },
  { char: FILE_TRIGGER, pattern: /(@\S*)$/ },
]);

const isSkillPanelVisible = computed(
  () =>
    triggerManager.isAnyPanelVisible.value &&
    triggerManager.activeTriggerChar.value === SKILL_TRIGGER,
);
const isFilePanelVisible = computed(
  () =>
    triggerManager.isAnyPanelVisible.value &&
    triggerManager.activeTriggerChar.value === FILE_TRIGGER,
);

const hasModels = computed(() => props.models.length > 0);
const defaultModel = computed(
  () => props.models.find((model) => model.modelId === props.defaultModelId) ?? null,
);
const selectedModel = computed(
  () =>
    props.models.find((model) => model.modelId === localSelectedModelId.value) ??
    defaultModel.value,
);
const contextWindow = computed(() => selectedModel.value?.contextWindow ?? 0);
const selectedModelName = computed(() => {
  if (!hasModels.value) return "未配置模型";
  const found = props.models.find((model) => model.modelId === localSelectedModelId.value);
  return found?.name || localSelectedModelId.value || "选择模型";
});
const shouldShowUsage = computed(
  () => hasModels.value && contextWindow.value > 0 && props.showUsage,
);
const selectedSkillKeys = computed(() => editorSkillKeys.value);
const isEditorEmpty = computed(() => {
  const textWithoutFileTags = editorComponentRef.value?.getTextWithoutFileTags();
  return (textWithoutFileTags ?? editorText.value).trim().length === 0;
});
const canSend = computed(() => props.isStreaming || !isEditorEmpty.value);

watch(
  () => props.defaultModelId,
  (modelId) => {
    if (modelId && !localSelectedModelId.value) {
      localSelectedModelId.value = modelId;
    }
  },
  { immediate: true },
);

watch(
  () => props.selectedModelId,
  (modelId) => {
    if (modelId) {
      localSelectedModelId.value = modelId;
      return;
    }

    if (!localSelectedModelId.value && props.defaultModelId) {
      localSelectedModelId.value = props.defaultModelId;
    }
  },
  { immediate: true },
);

watch(
  () => props.webSearchEnabled,
  (enabled) => {
    localWebSearchEnabled.value = enabled;
  },
  { immediate: true },
);

function getUsage(message: SenderUsageMessage | null | undefined): SenderUsageLike | null {
  if (!message || typeof message !== "object" || !("usage" in message)) {
    return null;
  }

  return message.usage ?? null;
}

function getUsedTokens(message: SenderUsageMessage | null | undefined) {
  const usage = getUsage(message);
  return (usage?.input ?? 0) + (usage?.output ?? 0);
}

function formatTokenCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}K`;
  return `${Math.round(count / 1000)}K`;
}

const historyUsedTokens = computed(() => {
  return props.messages.reduce((total, message) => total + getUsedTokens(message), 0);
});

const streamUsedTokens = computed(() => {
  if (!props.isStreaming || !props.streamMessage) {
    return 0;
  }
  return getUsedTokens(props.streamMessage);
});

const usedTokens = computed(() => historyUsedTokens.value + streamUsedTokens.value);

const usagePercent = computed(() => {
  if (!contextWindow.value) {
    return 0;
  }
  return (usedTokens.value / contextWindow.value) * 100;
});

const usagePercentText = computed(() => `${usagePercent.value.toFixed(1)}%`);
const usedTokensText = computed(() => formatTokenCount(usedTokens.value));
const contextWindowText = computed(() => formatTokenCount(contextWindow.value));

function getSkillKey(skill: { filePath: string; scope: string }) {
  return `${skill.scope}:${skill.filePath}`;
}

function getFileKey(file: { path: string }) {
  return file.path;
}

function getEditorInstance(): TiptapEditor | undefined {
  return editorComponentRef.value?.editor as TiptapEditor | undefined;
}

function syncSkillKeysFromEditor() {
  const tags = editorComponentRef.value?.getSkillTags() ?? [];
  editorSkillKeys.value = new Set(tags.map((t) => getSkillKey(t)));
}

function syncFileKeysFromEditor() {
  const tags = editorComponentRef.value?.getFileTags() ?? [];
  editorFileKeys.value = new Set(tags.map((t) => getFileKey(t)));
}

function getSelectedSkills(): SenderSkillReference[] {
  const tags = editorComponentRef.value?.getSkillTags() ?? [];
  return tags.map((tag) => ({
    name: tag.name,
    filePath: tag.filePath,
    scope: tag.scope,
  }));
}

function getSelectedFiles(): SenderFileReference[] {
  const tags = editorComponentRef.value?.getFileTags() ?? [];
  return tags.map((tag) => ({
    name: tag.name,
    path: tag.path,
    relativePath: tag.relativePath,
    extension: tag.extension,
  }));
}

function handleEditorUpdate() {
  const e = getEditorInstance();
  if (!e) return;
  tiptapEditor.value = e;
  triggerManager.syncFromEditor(e);
  syncSkillKeysFromEditor();
  syncFileKeysFromEditor();
}

function handleEditorSelectionUpdate() {
  const e = getEditorInstance();
  if (!e) return;
  tiptapEditor.value = e;
  triggerManager.syncFromEditor(e);
}

function handleEditorKeyDown(event: KeyboardEvent): boolean {
  if (!triggerManager.isAnyPanelVisible.value) return false;

  switch (event.key) {
    case "ArrowUp": {
      event.preventDefault();
      triggerManager.navigateUp();
      return true;
    }
    case "ArrowDown": {
      event.preventDefault();
      const resultCount = isSkillPanelVisible.value
        ? (skillPickerPanelRef.value?.filteredSkills?.length ?? 1)
        : (filePickerPanelRef.value?.filteredFiles?.length ?? 1);
      const maxIndex = resultCount - 1;
      triggerManager.navigateDown(maxIndex);
      return true;
    }
    case "Enter": {
      event.preventDefault();
      if (isSkillPanelVisible.value) {
        const skills = skillPickerPanelRef.value?.filteredSkills ?? [];
        const activeSkill = skills[triggerManager.activeIndex.value];
        if (activeSkill) {
          handleSkillSelect(activeSkill);
        }
        return true;
      }

      if (isFilePanelVisible.value) {
        const files = filePickerPanelRef.value?.filteredFiles ?? [];
        const activeFile = files[triggerManager.activeIndex.value];
        if (activeFile) {
          handleFileSelect(activeFile);
        }
      }
      return true;
    }
    case "Escape": {
      event.preventDefault();
      triggerManager.close();
      return true;
    }
    default:
      return false;
  }
}

function openSettings() {
  emit("open-settings");
}

function showModelTip() {
  showNoModelTip.value = true;
  setTimeout(() => {
    showNoModelTip.value = false;
  }, 3000);
}

function handleModelSelect(modelId: string) {
  localSelectedModelId.value = modelId;
  emit("update:selectedModelId", modelId);
}

function toggleWebSearch() {
  localWebSearchEnabled.value = !localWebSearchEnabled.value;
  emit("update:webSearchEnabled", localWebSearchEnabled.value);
}

async function handleSend() {
  if (!hasModels.value || !localSelectedModelId.value) {
    showModelTip();
    return;
  }

  const message = editorText.value.trim();
  const textWithoutFileTags = editorComponentRef.value?.getTextWithoutFileTags() ?? message;
  if (!textWithoutFileTags.trim()) {
    return;
  }

  emit("send", {
    message,
    selectedSkills: getSelectedSkills(),
    selectedFiles: getSelectedFiles(),
    modelId: localSelectedModelId.value,
    webSearchEnabled: localWebSearchEnabled.value,
  });

  editorText.value = "";
}

function handleAction() {
  if (props.isStreaming) {
    emit("stop");
    return;
  }
  void handleSend();
}

function handleSkillSelect(skill: SenderSkillOption) {
  const key = getSkillKey(skill);
  if (selectedSkillKeys.value.has(key)) {
    triggerManager.clearTriggerText();
    triggerManager.close();
    return;
  }
  triggerManager.clearTriggerText();
  triggerManager.close();
  editorComponentRef.value?.insertSkillTag({
    name: skill.name,
    filePath: skill.filePath,
    scope: skill.scope,
    scopeLabel: skill.scopeLabel,
  });
}

function handleFileSelect(file: SenderFileOption) {
  const key = getFileKey(file);
  if (editorFileKeys.value.has(key)) {
    triggerManager.clearTriggerText();
    triggerManager.close();
    return;
  }
  triggerManager.clearTriggerText();
  triggerManager.close();
  editorComponentRef.value?.insertFileTag({
    name: file.name,
    path: file.path,
    relativePath: file.relativePath,
    extension: file.extension,
  });
}
</script>

<template>
  <div class="relative">
    <div
      v-if="showNoModelTip"
      class="absolute -top-10 left-1/2 z-20 -translate-x-1/2 rounded-md bg-destructive px-3 py-1.5 text-xs text-white shadow-md"
    >
      请先前往
      <span class="cursor-pointer underline" @click="openSettings">设置</span>
      配置模型
    </div>

    <SkillPickerPanel
      v-if="isSkillPanelVisible"
      ref="skillPickerPanelRef"
      :skills="skills"
      :skills-loading="skillsLoading"
      :skills-error-message="skillsErrorMessage"
      :query="triggerManager.query.value"
      :active-index="triggerManager.activeIndex.value"
      :selected-skill-keys="selectedSkillKeys"
      :is-search-mode="triggerManager.isSearchMode.value"
      @select="handleSkillSelect"
    />

    <FilePickerPanel
      v-if="isFilePanelVisible"
      ref="filePickerPanelRef"
      :files="files"
      :files-loading="filesLoading"
      :files-error-message="filesErrorMessage"
      :query="triggerManager.query.value"
      :active-index="triggerManager.activeIndex.value"
      :selected-file-keys="editorFileKeys"
      :is-search-mode="triggerManager.isSearchMode.value"
      @select="handleFileSelect"
    />

    <div class="rounded-xl border border-border bg-card px-3 py-3">
      <div class="relative">
        <Editor
          ref="editorComponentRef"
          v-model="editorText"
          :on-key-down="handleEditorKeyDown"
          @editor-update="handleEditorUpdate"
          @editor-selection-update="handleEditorSelectionUpdate"
        />
      </div>

      <div class="mt-3 flex items-center gap-2 text-muted-foreground">
        <Button
          variant="ghost"
          size="icon"
          class="size-8 rounded-full"
          @click="triggerManager.toggleManualPanel(SKILL_TRIGGER)"
        >
          <PlusIcon class="size-4" />
          <span class="sr-only">选择技能</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          class="size-8 rounded-full"
          @click="triggerManager.toggleManualPanel(FILE_TRIGGER)"
        >
          <FileTextIcon class="size-4" />
          <span class="sr-only">选择文件</span>
        </Button>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                :variant="localWebSearchEnabled ? 'default' : 'ghost'"
                size="icon"
                class="size-5 rounded-full"
                @click="toggleWebSearch"
              >
                <GlobeIcon class="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {{ localWebSearchEnabled ? "关闭网络搜索" : "开启网络搜索" }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" class="rounded-full text-xs">
              <span class="max-w-[120px]">{{ selectedModelName }}</span>
              <ChevronsUpDownIcon class="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" class="[--radius:0.95rem]">
            <template v-if="hasModels">
              <DropdownMenuItem
                v-for="model in models"
                :key="model.modelId"
                class="gap-2"
                @click="handleModelSelect(model.modelId)"
              >
                <CheckIcon
                  class="size-3"
                  :class="localSelectedModelId === model.modelId ? 'opacity-100' : 'opacity-0'"
                />
                <span>{{ model.name }}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </template>
            <template v-else>
              <div class="px-3 py-2 text-center text-xs text-muted-foreground">暂无可用模型</div>
              <DropdownMenuSeparator />
            </template>
            <DropdownMenuItem class="gap-2" @click="openSettings">
              <SettingsIcon class="size-3" />
              <span>前往设置</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div class="ml-auto flex items-center gap-2">
          <TooltipProvider v-if="shouldShowUsage">
            <Tooltip>
              <TooltipTrigger as-child>
                <div class="flex cursor-pointer items-center p-1">
                  <CircularProgress class="cursor-pointer" :size="16" :progress="usagePercent" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" align="center">
                <div>{{ usagePercentText }} · {{ usedTokensText }} / {{ contextWindowText }}</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="default"
            size="icon"
            class="size-7 rounded-full"
            :disabled="!canSend"
            @click="handleAction"
          >
            <SquareIcon v-if="isStreaming" class="size-3 fill-current" />
            <ArrowUpIcon v-else class="size-3" />
            <span class="sr-only">{{ isStreaming ? "Stop" : "Send" }}</span>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
