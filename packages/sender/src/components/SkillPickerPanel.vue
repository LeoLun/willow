<script setup lang="ts">
import { Badge } from "@willow/shadcn/components/ui/badge";
import { Separator } from "@willow/shadcn/components/ui/separator";
import { cn } from "@willow/shadcn/lib/utils";
import { BoxesIcon } from "lucide-vue-next";
import { computed } from "vue";
import type { SenderSkillOption } from "../types";

const props = withDefaults(
  defineProps<{
    skills: SenderSkillOption[];
    skillsLoading?: boolean;
    skillsErrorMessage?: string;
    query: string;
    activeIndex: number;
    selectedSkillKeys: Set<string>;
    isSearchMode: boolean;
  }>(),
  {
    skillsLoading: false,
    skillsErrorMessage: "",
  },
);

const emit = defineEmits<{
  select: [skill: SenderSkillOption];
}>();

const normalizedQuery = computed(() => props.query.trim().toLowerCase());

const filteredSkills = computed(() => {
  if (!props.isSearchMode || !normalizedQuery.value) {
    return props.skills;
  }

  return props.skills.filter((skill) => {
    const haystack = `${skill.name} ${skill.description}`.toLowerCase();
    return haystack.includes(normalizedQuery.value);
  });
});

const groupedSkills = computed(() => ({
  global: props.skills.filter((skill) => skill.scope === "global"),
  workspace: props.skills.filter((skill) => skill.scope === "workspace"),
}));

function getSkillKey(skill: Pick<SenderSkillOption, "filePath" | "scope">) {
  return `${skill.scope}:${skill.filePath}`;
}

function getSkillItemClasses(skill: SenderSkillOption, index: number) {
  const isActive = index === props.activeIndex;
  const isSelected = props.selectedSkillKeys.has(getSkillKey(skill));
  return cn(
    "flex w-full items-center gap-3 rounded-xl px-3 py-1 text-left transition-colors",
    isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
    isSelected ? "opacity-80" : "",
  );
}

defineExpose({ filteredSkills });
</script>

<template>
  <div
    class="absolute right-0 bottom-[calc(100%_+_0.625rem)] left-0 z-10 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
  >
    <div class="px-3 pt-3 text-sm font-medium text-foreground">技能</div>

    <div v-if="skillsLoading" class="px-3 py-2 text-sm text-muted-foreground">正在加载技能…</div>
    <div v-else-if="skillsErrorMessage" class="px-3 py-2 text-sm text-destructive">
      {{ skillsErrorMessage }}
    </div>
    <div v-else-if="skills.length === 0" class="px-3 py-2 text-sm text-muted-foreground">
      当前没有可用技能，仍可直接发送普通消息。
    </div>
    <div
      v-else-if="isSearchMode && filteredSkills.length === 0"
      class="px-3 py-2 text-sm text-muted-foreground"
    >
      没有匹配 `/{{ query }}` 的技能。
    </div>
    <div v-else class="max-h-72 overflow-y-auto p-0">
      <div v-if="isSearchMode" class="space-y-1 p-2">
        <button
          v-for="(skill, index) in filteredSkills"
          :key="getSkillKey(skill)"
          type="button"
          :class="getSkillItemClasses(skill, index)"
          @mousedown.prevent
          @click="emit('select', skill)"
        >
          <div
            class="flex size-3 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
          >
            <BoxesIcon class="size-3" />
          </div>
          <div class="min-w-0 flex-1 truncate">
            <span class="truncate text-sm font-medium">{{ skill.name }}</span>
            <span class="truncate text-xs text-muted-foreground">{{
              " " + skill.description
            }}</span>
          </div>
          <Badge variant="outline" class="ml-2 shrink-0 text-[11px]">
            {{ skill.scopeLabel }}
          </Badge>
        </button>
      </div>

      <div v-else class="p-2">
        <div v-if="groupedSkills.global.length > 0" class="space-y-1">
          <div class="px-2 py-1 text-xs font-medium text-muted-foreground">全局技能</div>
          <button
            v-for="skill in groupedSkills.global"
            :key="getSkillKey(skill)"
            type="button"
            class="flex w-full items-center gap-3 rounded-xl px-3 py-1 text-left transition-colors hover:bg-accent/60"
            @mousedown.prevent
            @click="emit('select', skill)"
          >
            <div
              class="flex size-3 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <BoxesIcon class="size-3" />
            </div>
            <div class="min-w-0 flex-1 truncate">
              <span class="truncate text-sm font-medium">{{ skill.name }}</span>
              <span class="truncate text-xs text-muted-foreground">{{
                " " + skill.description
              }}</span>
            </div>
            <Badge variant="outline" class="ml-2 shrink-0 text-[11px]">
              {{ skill.scopeLabel }}
            </Badge>
          </button>
        </div>
        <Separator
          v-if="groupedSkills.global.length > 0 && groupedSkills.workspace.length > 0"
          class="my-2"
        />

        <div v-if="groupedSkills.workspace.length > 0" class="space-y-1">
          <div class="px-2 py-1 text-xs font-medium text-muted-foreground">当前工作空间技能</div>
          <button
            v-for="skill in groupedSkills.workspace"
            :key="getSkillKey(skill)"
            type="button"
            class="flex w-full items-center gap-3 rounded-xl px-3 py-1 text-left transition-colors hover:bg-accent/60"
            @mousedown.prevent
            @click="emit('select', skill)"
          >
            <div
              class="flex size-3 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <BoxesIcon class="size-3" />
            </div>
            <div class="min-w-0 flex-1 truncate">
              <span class="truncate text-sm font-medium">{{ skill.name }}</span>
              <span class="truncate text-xs text-muted-foreground">{{
                " " + skill.description
              }}</span>
            </div>
            <Badge variant="outline" class="ml-2 shrink-0 text-[11px]">
              {{ skill.scopeLabel }}
            </Badge>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
