<script setup lang="ts">
import { cn } from "@willow/shadcn/lib/utils";
import {
  BlocksIcon,
  FileCodeIcon,
  FileJsonIcon,
  FileTextIcon,
  ImageIcon,
  PuzzleIcon,
} from "lucide-vue-next";
import { computed } from "vue";
import type { Component } from "vue";
import type {
  SenderFileOption,
  SenderPluginOption,
  SenderResourcePickerItem,
  SenderSkillOption,
} from "../types";

interface ResourcePickerGroup {
  type: "plugin" | "skill" | "file";
  label: string;
  items: SenderResourcePickerItem[];
  loading: boolean;
  errorMessage: string;
  emptyMessage: string;
}

const props = withDefaults(
  defineProps<{
    plugins?: SenderPluginOption[];
    pluginsLoading?: boolean;
    pluginsErrorMessage?: string;
    skills: SenderSkillOption[];
    skillsLoading?: boolean;
    skillsErrorMessage?: string;
    files: SenderFileOption[];
    filesLoading?: boolean;
    filesErrorMessage?: string;
    query: string;
    activeIndex: number;
    selectedSkillKeys: Set<string>;
    selectedFileKeys: Set<string>;
    isSearchMode: boolean;
  }>(),
  {
    plugins: () => [],
    pluginsLoading: false,
    pluginsErrorMessage: "",
    skillsLoading: false,
    skillsErrorMessage: "",
    filesLoading: false,
    filesErrorMessage: "",
  },
);

const emit = defineEmits<{
  "select-plugin": [plugin: SenderPluginOption];
  "select-skill": [skill: SenderSkillOption];
  "select-file": [file: SenderFileOption];
}>();

const normalizedQuery = computed(() => props.query.trim().toLowerCase());

const filteredPlugins = computed(() => {
  if (!props.isSearchMode || !normalizedQuery.value) {
    return props.plugins;
  }

  return props.plugins.filter((plugin) => {
    const haystack = `${plugin.name} ${plugin.description}`.toLowerCase();
    return haystack.includes(normalizedQuery.value);
  });
});

const filteredSkills = computed(() => {
  if (!props.isSearchMode || !normalizedQuery.value) {
    return props.skills;
  }

  return props.skills.filter((skill) => {
    const haystack = `${skill.name} ${skill.description}`.toLowerCase();
    return haystack.includes(normalizedQuery.value);
  });
});

const filteredFiles = computed(() => {
  if (!props.isSearchMode || !normalizedQuery.value) {
    return props.files;
  }

  return props.files.filter((file) => {
    const haystack = `${file.name} ${file.relativePath}`.toLowerCase();
    return haystack.includes(normalizedQuery.value);
  });
});

function getPluginKey(plugin: SenderPluginOption) {
  return plugin.id || plugin.name;
}

function getSkillKey(skill: Pick<SenderSkillOption, "filePath" | "scope">) {
  return `${skill.scope}:${skill.filePath}`;
}

function getFileKey(file: Pick<SenderFileOption, "path">) {
  return file.path;
}

const pluginItems = computed<SenderResourcePickerItem[]>(() =>
  filteredPlugins.value.map((plugin) => ({
    type: "plugin",
    key: `plugin:${getPluginKey(plugin)}`,
    plugin,
  })),
);

const skillItems = computed<SenderResourcePickerItem[]>(() =>
  filteredSkills.value.map((skill) => ({
    type: "skill",
    key: `skill:${getSkillKey(skill)}`,
    skill,
  })),
);

const fileItems = computed<SenderResourcePickerItem[]>(() =>
  filteredFiles.value.map((file) => ({
    type: "file",
    key: `file:${getFileKey(file)}`,
    file,
  })),
);

const groups = computed<ResourcePickerGroup[]>(() => [
  {
    type: "plugin",
    label: "插件",
    items: pluginItems.value,
    loading: props.pluginsLoading,
    errorMessage: props.pluginsErrorMessage,
    emptyMessage: "当前没有可用插件。",
  },
  {
    type: "skill",
    label: "技能",
    items: skillItems.value,
    loading: props.skillsLoading,
    errorMessage: props.skillsErrorMessage,
    emptyMessage: "当前没有可用技能。",
  },
  {
    type: "file",
    label: "文件",
    items: fileItems.value,
    loading: props.filesLoading,
    errorMessage: props.filesErrorMessage,
    emptyMessage: "当前工作空间没有可引用的文件。",
  },
]);

const visibleGroups = computed(() =>
  groups.value.filter((group) => group.items.length > 0 || group.loading || group.errorMessage),
);

const visibleItems = computed<SenderResourcePickerItem[]>(() =>
  visibleGroups.value.flatMap((group) => group.items),
);

const showNoResults = computed(
  () =>
    visibleItems.value.length === 0 &&
    groups.value.every((group) => !group.loading && !group.errorMessage),
);

function getItemIndex(item: SenderResourcePickerItem) {
  return visibleItems.value.findIndex((visibleItem) => visibleItem.key === item.key);
}

function isItemSelected(item: SenderResourcePickerItem) {
  if (item.type === "skill") {
    return props.selectedSkillKeys.has(getSkillKey(item.skill));
  }
  if (item.type === "file") {
    return props.selectedFileKeys.has(getFileKey(item.file));
  }
  return false;
}

function getItemClasses(item: SenderResourcePickerItem) {
  const itemIndex = getItemIndex(item);
  const isActive = itemIndex === props.activeIndex;
  const isSelected = isItemSelected(item);
  return cn(
    "flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors",
    isActive ? "bg-muted text-foreground" : "hover:bg-muted/60",
    isSelected ? "opacity-70" : "",
  );
}

function iconForFile(extension?: string): Component {
  switch (extension) {
    case "json":
      return FileJsonIcon;
    case "ts":
    case "js":
    case "tsx":
    case "jsx":
    case "vue":
    case "py":
      return FileCodeIcon;
    case "png":
    case "jpg":
    case "jpeg":
    case "svg":
    case "gif":
      return ImageIcon;
    default:
      return FileTextIcon;
  }
}

function getItemIcon(item: SenderResourcePickerItem): Component {
  if (item.type === "plugin") return PuzzleIcon;
  if (item.type === "skill") return BlocksIcon;
  return iconForFile(item.file.extension);
}

function getItemLabel(item: SenderResourcePickerItem) {
  if (item.type === "plugin") return item.plugin.name;
  if (item.type === "skill") return item.skill.name;
  return item.file.name;
}

function getItemDescription(item: SenderResourcePickerItem) {
  if (item.type === "plugin") return item.plugin.description;
  if (item.type === "skill") return item.skill.description;
  return item.file.relativePath;
}

function selectItem(item: SenderResourcePickerItem) {
  if (item.type === "plugin") {
    emit("select-plugin", item.plugin);
    return;
  }
  if (item.type === "skill") {
    emit("select-skill", item.skill);
    return;
  }
  emit("select-file", item.file);
}

defineExpose({ visibleItems });
</script>

<template>
  <div
    class="absolute right-0 bottom-[calc(100%_+_0.625rem)] left-0 z-10 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
  >
    <div class="max-h-[26.25rem] overflow-y-auto px-4 py-3">
      <div v-if="showNoResults" class="px-1 py-2 text-sm text-muted-foreground">
        没有匹配的资源。
      </div>

      <div v-else class="space-y-2">
        <template v-for="group in visibleGroups" :key="group.type">
          <section class="space-y-1">
            <div class="px-1 text-sm font-medium text-muted-foreground">{{ group.label }}</div>

            <div v-if="group.loading" class="px-1 py-1.5 text-sm text-muted-foreground">
              正在加载{{ group.label }}...
            </div>
            <div v-else-if="group.errorMessage" class="px-1 py-1.5 text-sm text-destructive">
              {{ group.errorMessage }}
            </div>
            <div
              v-else-if="group.items.length === 0 && !isSearchMode"
              class="px-1 py-1.5 text-sm text-muted-foreground"
            >
              {{ group.emptyMessage }}
            </div>

            <button
              v-for="item in group.items"
              :key="item.key"
              type="button"
              :class="getItemClasses(item)"
              @mousedown.prevent
              @click="selectItem(item)"
            >
              <component :is="getItemIcon(item)" class="size-4 shrink-0 text-muted-foreground" />
              <div class="min-w-0 flex-1 truncate">
                <span class="truncate text-sm font-semibold text-foreground">
                  {{ getItemLabel(item) }}
                </span>
                <span class="ml-2 truncate text-xs text-muted-foreground">
                  {{ getItemDescription(item) }}
                </span>
              </div>
            </button>
          </section>
        </template>
      </div>
    </div>
  </div>
</template>
