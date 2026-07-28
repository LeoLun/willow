<script setup lang="ts">
import type { SkillInfo } from "@shared/api";
import { BoxIcon } from "lucide-vue-next";
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { electronAPI } from "@/lib/ipc";

const props = defineProps<{
  workspaceId?: number;
  query: string;
}>();

const emit = defineEmits<{
  select: [skill: SkillInfo];
}>();

const skills = shallowRef<SkillInfo[]>([]);
const loading = ref(false);
const loadError = ref(false);
let generation = 0;

const matchingSkills = computed(() => {
  const normalizedQuery = props.query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return skills.value;
  return skills.value.filter(
    (skill) =>
      skill.name.toLocaleLowerCase().includes(normalizedQuery) ||
      skill.description.toLocaleLowerCase().includes(normalizedQuery),
  );
});

async function loadSkills(): Promise<void> {
  const currentWorkspaceId = props.workspaceId;
  const currentGeneration = ++generation;
  skills.value = [];
  loadError.value = false;

  if (!currentWorkspaceId) {
    loading.value = false;
    return;
  }

  loading.value = true;
  try {
    const response = await electronAPI.getSkillList({ workspaceId: currentWorkspaceId });
    if (currentGeneration !== generation) return;
    skills.value = response.skills;
  } catch (error) {
    if (currentGeneration !== generation) return;
    loadError.value = true;
    console.error("读取 skills 列表失败:", error);
  } finally {
    if (currentGeneration === generation) loading.value = false;
  }
}

watch(() => props.workspaceId, loadSkills, { immediate: true });

onBeforeUnmount(() => {
  generation += 1;
});
</script>

<template>
  <div data-slot="skill-list">
    <p class="px-2 text-xs font-medium text-foreground" data-slot="skill-list-label">技能</p>
    <p
      v-if="loading"
      class="mt-1 text-sm leading-6 text-muted-foreground"
      data-slot="skill-list-loading"
    >
      正在读取 skills…
    </p>
    <p
      v-else-if="loadError"
      class="mt-1 text-sm leading-6 text-destructive"
      data-slot="skill-list-error"
    >
      无法读取 skills 列表
    </p>
    <p
      v-else-if="skills.length === 0"
      class="mt-1 text-sm leading-6 text-muted-foreground"
      data-slot="skill-list-empty"
    >
      当前工作区没有可用的 skill
    </p>
    <div v-else-if="matchingSkills.length > 0" class="mt-1">
      <button
        v-for="skill in matchingSkills"
        :key="skill.filePath"
        type="button"
        class="grid min-h-7 w-full grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2 rounded-xl px-2 text-left text-sm leading-6 transition-colors hover:bg-accent/60"
        data-slot="skill-list-item"
        :title="skill.filePath"
        @click="emit('select', skill)"
      >
        <BoxIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span class="whitespace-nowrap text-foreground">
          {{ skill.name }}
        </span>
        <span class="truncate text-muted-foreground">
          {{ skill.description }}
        </span>
      </button>
    </div>
    <p v-else class="mt-1 text-sm leading-6 text-muted-foreground">没有匹配的 skill</p>
  </div>
</template>
