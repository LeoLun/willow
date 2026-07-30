<script setup lang="ts">
import type { BuiltinSkillInfo, SkillInfo, WorkspaceInfo } from "@shared/api";
import { Skeleton } from "@willow/shadcn/components/ui/skeleton";
import { Switch } from "@willow/shadcn/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@willow/shadcn/components/ui/tabs";
import { Blocks, FolderKanban, RefreshCw, Search } from "lucide-vue-next";
import { computed, onMounted, ref, shallowRef } from "vue";
import { Button } from "@/components/ui/button";
import { electronAPI } from "@/lib/ipc";

interface ProjectSkillGroup {
  workspace: WorkspaceInfo;
  skills: SkillInfo[];
  error?: string;
}

type InstalledSkill =
  | { key: string; kind: "builtin"; skill: BuiltinSkillInfo }
  | { key: string; kind: "global"; skill: SkillInfo };

type InstalledSkillTab = "builtin" | "global";

const builtinSkills = shallowRef<BuiltinSkillInfo[]>([]);
const globalSkills = shallowRef<SkillInfo[]>([]);
const projectGroups = shallowRef<ProjectSkillGroup[]>([]);
const selectedInstalledTab = ref<InstalledSkillTab>("builtin");
const selectedWorkspaceId = ref<number>();
const searchQuery = ref("");
const pendingSkillIds = shallowRef<ReadonlySet<string>>(new Set());
const skillErrors = shallowRef<Readonly<Record<string, string>>>({});
const loading = ref(true);
const loadError = ref("");

const normalizedQuery = computed(() => searchQuery.value.trim().toLocaleLowerCase());

const installedTabs = computed(() => [
  { id: "builtin" as const, label: "内置技能", count: builtinSkills.value.length },
  { id: "global" as const, label: "全局技能", count: globalSkills.value.length },
]);

const installedSkills = computed<Record<InstalledSkillTab, InstalledSkill[]>>(() => ({
  builtin: builtinSkills.value.map(
    (skill): InstalledSkill => ({ key: `builtin:${skill.id}`, kind: "builtin", skill }),
  ),
  global: globalSkills.value.map(
    (skill): InstalledSkill => ({ key: `global:${skill.filePath}`, kind: "global", skill }),
  ),
}));

const matchingInstalledSkills = computed<Record<InstalledSkillTab, InstalledSkill[]>>(() => ({
  builtin: installedSkills.value.builtin.filter(({ skill }) => matchesSearch(skill)),
  global: installedSkills.value.global.filter(({ skill }) => matchesSearch(skill)),
}));

const matchingProjectSkills = computed(
  () =>
    new Map(
      projectGroups.value.map((group) => [
        group.workspace.id,
        group.skills.filter((skill) => matchesSearch(skill)),
      ]),
    ),
);

function matchesSearch(skill: Pick<SkillInfo, "name" | "description">): boolean {
  if (!normalizedQuery.value) return true;
  return `${skill.name} ${skill.description}`.toLocaleLowerCase().includes(normalizedQuery.value);
}

function replaceBuiltinSkill(skillId: string, update: Partial<BuiltinSkillInfo>): void {
  builtinSkills.value = builtinSkills.value.map((skill) =>
    skill.id === skillId ? { ...skill, ...update } : skill,
  );
}

function setSkillPending(skillId: string, pending: boolean): void {
  const next = new Set(pendingSkillIds.value);
  if (pending) next.add(skillId);
  else next.delete(skillId);
  pendingSkillIds.value = next;
}

function setSkillError(skillId: string, message?: string): void {
  const next = { ...skillErrors.value };
  if (message) next[skillId] = message;
  else delete next[skillId];
  skillErrors.value = next;
}

function uniqueGlobalSkills(groups: ProjectSkillGroup[]): SkillInfo[] {
  const skillsByPath = new Map<string, SkillInfo>();
  for (const group of groups) {
    for (const skill of group.skills) {
      if (skill.source === "global") skillsByPath.set(skill.filePath, skill);
    }
  }
  return [...skillsByPath.values()];
}

async function loadProjectGroup(workspace: WorkspaceInfo): Promise<ProjectSkillGroup> {
  try {
    const response = await electronAPI.getSkillList({ workspaceId: workspace.id });
    return {
      workspace,
      skills: response.skills.filter((skill) => skill.source !== "builtin"),
    };
  } catch {
    return { workspace, skills: [], error: "无法读取此项目的技能。" };
  }
}

async function loadSkills(): Promise<void> {
  loading.value = true;
  loadError.value = "";
  try {
    const [builtinResponse, pinnedResponse, unpinnedResponse] = await Promise.all([
      electronAPI.getBuiltinSkillList(),
      electronAPI.getWorkspaceList({ pinned: true }),
      electronAPI.getWorkspaceList({ pinned: false }),
    ]);
    const workspaces = [...pinnedResponse.workspaces, ...unpinnedResponse.workspaces];
    const groups = await Promise.all(workspaces.map(loadProjectGroup));

    builtinSkills.value = builtinResponse.skills;
    projectGroups.value = groups.map((group) => ({
      ...group,
      skills: group.skills.filter((skill) => skill.source === "project"),
    }));
    globalSkills.value = uniqueGlobalSkills(groups);

    if (
      selectedWorkspaceId.value === undefined ||
      !groups.some((group) => group.workspace.id === selectedWorkspaceId.value)
    ) {
      selectedWorkspaceId.value = groups[0]?.workspace.id;
    }
  } catch {
    loadError.value = "无法读取技能列表，请重试。";
  } finally {
    loading.value = false;
  }
}

async function setSkillEnabled(skill: BuiltinSkillInfo, enabled: boolean): Promise<void> {
  if (pendingSkillIds.value.has(skill.id)) return;

  const previousEnabled = skill.enabled;
  setSkillError(skill.id);
  setSkillPending(skill.id, true);
  replaceBuiltinSkill(skill.id, { enabled });
  try {
    const response = await electronAPI.setBuiltinSkillEnabled({ id: skill.id, enabled });
    replaceBuiltinSkill(skill.id, response.skill);
  } catch {
    replaceBuiltinSkill(skill.id, { enabled: previousEnabled });
    setSkillError(skill.id, "保存失败，请重试。");
  } finally {
    setSkillPending(skill.id, false);
  }
}

onMounted(() => void loadSkills());
</script>

<template>
  <div class="h-full min-h-0 overflow-y-auto bg-background" data-slot="builtin-skills-page">
    <main class="mx-auto w-full max-w-5xl px-6 pt-14 pb-16 sm:px-10 lg:px-14">
      <header>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">技能</h1>
        <p class="mt-2 text-sm text-muted-foreground">通过任务专用技能扩展 Willow 的能力</p>
      </header>

      <div v-if="loading" class="mt-4" data-slot="builtin-skills-loading">
        <Skeleton class="mb-6 h-6 w-20" />
        <div class="grid gap-x-14 gap-y-8 border-t pt-8 md:grid-cols-2">
          <div v-for="index in 6" :key="index" class="flex items-center gap-4">
            <Skeleton class="size-12 shrink-0 rounded-2xl" />
            <div class="min-w-0 flex-1 space-y-2">
              <Skeleton class="h-4 w-32" />
              <Skeleton class="h-3 w-4/5" />
            </div>
          </div>
        </div>
      </div>

      <section
        v-else-if="loadError"
        class="mt-4 flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed px-6 text-center"
        data-slot="builtin-skills-error"
        role="alert"
      >
        <Blocks class="size-10 text-muted-foreground" aria-hidden="true" />
        <p class="mt-4 text-sm font-medium text-foreground">技能加载失败</p>
        <p class="mt-1 text-sm text-muted-foreground">{{ loadError }}</p>
        <Button
          variant="secondary"
          class="mt-5"
          data-slot="builtin-skills-retry"
          @click="loadSkills"
        >
          <RefreshCw aria-hidden="true" />
          重试
        </Button>
      </section>

      <template v-else>
        <section class="mt-4" aria-labelledby="installed-skills-heading">
          <div class="flex items-end justify-between gap-4">
            <h2 id="installed-skills-heading" class="text-lg font-semibold text-foreground">
              全局与内置技能
            </h2>
            <span class="text-sm text-muted-foreground">
              {{ builtinSkills.length + globalSkills.length }} 项
            </span>
          </div>

          <Tabs v-model="selectedInstalledTab" class="mt-2 gap-0">
            <TabsList
              class="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-0 pb-3"
              aria-label="选择技能来源"
            >
              <TabsTrigger
                v-for="tab in installedTabs"
                :key="tab.id"
                :value="tab.id"
                class="h-auto flex-none rounded-xl border-0 px-3 py-1.5 font-normal text-muted-foreground shadow-none hover:bg-muted/60 hover:text-foreground data-[state=active]:bg-muted data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none"
                :data-skill-source="tab.id"
                data-slot="installed-skill-tab"
              >
                {{ tab.label }}
                <span class="ml-1 text-xs text-muted-foreground">{{ tab.count }}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent v-for="tab in installedTabs" :key="tab.id" :value="tab.id" class="mt-8">
              <div
                v-if="matchingInstalledSkills[tab.id].length"
                class="grid gap-x-14 gap-y-8 md:grid-cols-2"
                data-slot="builtin-skills-list"
              >
                <article
                  v-for="item in matchingInstalledSkills[tab.id]"
                  :key="item.key"
                  class="flex min-w-0 items-start gap-4"
                  :data-slot="item.kind === 'builtin' ? 'builtin-skill-item' : 'global-skill-item'"
                >
                  <div
                    class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground"
                    aria-hidden="true"
                  >
                    <Blocks class="size-5" />
                  </div>
                  <div class="min-w-0 flex-1" data-slot="installed-skill-content">
                    <div
                      class="flex min-w-0 items-center gap-3"
                      data-slot="installed-skill-title-row"
                    >
                      <h3 class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {{ item.skill.name }}
                      </h3>
                      <Switch
                        v-if="item.kind === 'builtin'"
                        class="shrink-0"
                        :model-value="item.skill.enabled"
                        :disabled="pendingSkillIds.has(item.skill.id)"
                        :aria-label="`${item.skill.enabled ? '关闭' : '开启'}技能 ${item.skill.name}`"
                        :aria-busy="pendingSkillIds.has(item.skill.id) || undefined"
                        data-slot="builtin-skill-switch"
                        @update:model-value="
                          (enabled: boolean) =>
                            setSkillEnabled(item.skill as BuiltinSkillInfo, enabled)
                        "
                      />
                    </div>
                    <p
                      class="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground"
                      data-slot="installed-skill-description"
                    >
                      {{ item.skill.description }}
                    </p>
                    <p
                      v-if="item.kind === 'builtin' && skillErrors[item.skill.id]"
                      class="mt-1 text-xs text-destructive"
                      data-slot="builtin-skill-error"
                      role="alert"
                    >
                      {{ skillErrors[item.skill.id] }}
                    </p>
                  </div>
                </article>
              </div>

              <div
                v-else
                class="flex min-h-30 flex-col items-center justify-center text-center"
                data-slot="builtin-skills-empty"
              >
                <Blocks class="size-8 text-muted-foreground" aria-hidden="true" />
                <p class="mt-3 text-sm text-muted-foreground">
                  {{
                    searchQuery
                      ? `没有匹配的${tab.id === "builtin" ? "内置" : "全局"}技能`
                      : `暂无${tab.id === "builtin" ? "内置" : "全局"}技能`
                  }}
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </section>

        <section class="mt-8" aria-labelledby="project-skills-heading">
          <div class="flex items-end justify-between gap-4">
            <div>
              <h2 id="project-skills-heading" class="text-lg font-semibold text-foreground">
                项目技能
              </h2>
              <p class="mt-1 text-sm text-muted-foreground">技能仅在所属项目中生效</p>
            </div>
            <span class="text-sm text-muted-foreground">{{ projectGroups.length }} 个项目</span>
          </div>

          <Tabs
            v-if="projectGroups.length && selectedWorkspaceId !== undefined"
            v-model="selectedWorkspaceId"
            class="mt-4 gap-0"
          >
            <TabsList
              class="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-0 pb-3"
              aria-label="选择项目"
            >
              <TabsTrigger
                v-for="group in projectGroups"
                :key="group.workspace.id"
                :value="group.workspace.id"
                class="h-auto flex-none rounded-xl border-0 px-3 py-1.5 font-normal text-muted-foreground shadow-none hover:bg-muted/60 hover:text-foreground data-[state=active]:bg-muted data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                {{ group.workspace.name }}
              </TabsTrigger>
            </TabsList>

            <TabsContent
              v-for="group in projectGroups"
              :key="group.workspace.id"
              :value="group.workspace.id"
              class="mt-8"
            >
              <div
                v-if="group.error"
                class="flex min-h-36 flex-col items-center justify-center text-center"
                role="alert"
              >
                <FolderKanban class="size-8 text-muted-foreground" aria-hidden="true" />
                <p class="mt-3 text-sm text-muted-foreground">{{ group.error }}</p>
              </div>

              <div
                v-else-if="matchingProjectSkills.get(group.workspace.id)?.length"
                class="grid gap-x-14 gap-y-8 md:grid-cols-2"
                data-slot="project-skills-list"
              >
                <article
                  v-for="skill in matchingProjectSkills.get(group.workspace.id)"
                  :key="skill.filePath"
                  class="flex min-w-0 items-start gap-4"
                  data-slot="project-skill-item"
                  :title="skill.filePath"
                >
                  <div
                    class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground"
                    aria-hidden="true"
                  >
                    <Blocks class="size-5" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <h3 class="truncate text-sm font-medium text-foreground">{{ skill.name }}</h3>
                    <p class="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {{ skill.description }}
                    </p>
                  </div>
                </article>
              </div>

              <div v-else class="flex min-h-40 flex-col items-center justify-center text-center">
                <FolderKanban class="size-8 text-muted-foreground" aria-hidden="true" />
                <p class="mt-3 text-sm text-muted-foreground">
                  {{ searchQuery ? "当前项目没有匹配的技能" : "当前项目暂无技能" }}
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div v-else class="mt-4 flex min-h-40 flex-col items-center justify-center text-center">
            <FolderKanban class="size-8 text-muted-foreground" aria-hidden="true" />
            <p class="mt-3 text-sm text-muted-foreground">暂无项目</p>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>
