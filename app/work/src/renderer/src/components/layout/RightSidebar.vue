<script setup lang="ts">
import { ref } from "vue";
import { ChevronDown, FolderOpen, FileOutput, Sparkles } from "lucide-vue-next";

interface PanelItem {
  id: string;
  label: string;
  icon: typeof FolderOpen;
  content: string;
}

const panels: PanelItem[] = [
  { id: "cwd", label: "当前目录", icon: FolderOpen, content: "~/projects/willow" },
  { id: "output", label: "产出", icon: FileOutput, content: "暂无产出" },
  { id: "skill", label: "Skill", icon: Sparkles, content: "暂无可用 skill" },
];

const expandedPanels = ref<Set<string>>(new Set(["cwd"]));

function togglePanel(id: string) {
  if (expandedPanels.value.has(id)) {
    expandedPanels.value.delete(id);
  } else {
    expandedPanels.value.add(id);
  }
}
</script>

<template>
  <aside class="flex h-full flex-col">
    <!-- 面板列表 -->
    <div class="flex-1 overflow-y-auto">
      <div
        v-for="(panel, index) in panels"
        :key="panel.id"
      >
        <!-- 面板 header -->
        <button
          class="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          :class="index > 0 ? 'border-t border-border' : ''"
          :aria-expanded="expandedPanels.has(panel.id)"
          :aria-label="`${expandedPanels.has(panel.id) ? '收起' : '展开'} ${panel.label}`"
          @click="togglePanel(panel.id)"
        >
          <ChevronDown
            class="size-3.5 shrink-0 transition-transform duration-200"
            :class="expandedPanels.has(panel.id) ? '' : '-rotate-90'"
            aria-hidden="true"
          />
          <component :is="panel.icon" class="size-3.5 shrink-0" aria-hidden="true" />
          <span class="uppercase tracking-wide">{{ panel.label }}</span>
        </button>

        <!-- 面板内容 -->
        <div
          v-if="expandedPanels.has(panel.id)"
          class="px-3 pb-3"
        >
          <div class="pl-[22px]">
            <p class="text-xs text-muted-foreground/70">{{ panel.content }}</p>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
