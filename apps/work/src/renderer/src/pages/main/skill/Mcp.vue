<script setup lang="ts">
import type { WorkspaceInfo } from "@shared/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@willow/shadcn/components/ui/tabs";
import { computed, onMounted, ref, shallowRef } from "vue";
import { Button } from "@/components/ui/button";
import { electronAPI } from "@/lib/ipc";
import McpPanel from "./McpPanel.vue";

const props = defineProps<{ workspaceId?: number }>();
const emit = defineEmits<{ "select-project": [workspaceId: number] }>();
const workspaces = shallowRef<WorkspaceInfo[]>([]);
const loading = ref(true);
const error = ref("");
const selectedProject = computed(() =>
  String(
    workspaces.value.find((workspace) => workspace.id === props.workspaceId)?.id ??
      workspaces.value[0]?.id ??
      "",
  ),
);
async function loadProjects() {
  loading.value = true;
  error.value = "";
  try {
    const [pinned, unpinned] = await Promise.all([
      electronAPI.getWorkspaceList({ pinned: true }),
      electronAPI.getWorkspaceList({ pinned: false }),
    ]);
    workspaces.value = [...pinned.workspaces, ...unpinned.workspaces];
  } catch {
    error.value = "无法读取项目列表，请重试。";
  } finally {
    loading.value = false;
  }
}
onMounted(() => void loadProjects());
</script>

<template>
  <div class="min-h-0 min-w-0 flex-1 overflow-y-auto" data-slot="mcp-page">
    <main class="mx-auto w-full max-w-5xl px-6 pt-6 pb-16 sm:px-10 lg:px-14">
      <header>
        <h1 class="text-2xl font-semibold tracking-tight">MCP</h1>
        <p class="mt-2 text-sm text-muted-foreground">连接服务，为 Willow 扩展工具能力</p>
      </header>
      <section class="mt-4">
        <McpPanel :target="{ scope: 'global' }" title="全局 MCP" heading />
      </section>
      <section class="mt-8">
        <div class="flex items-end justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold">项目 MCP</h2>
            <p class="mt-1 text-sm text-muted-foreground">项目配置仅在所属项目中生效</p>
          </div>
          <span class="text-sm text-muted-foreground">{{ workspaces.length }} 个项目</span>
        </div>
        <p v-if="loading" class="text-sm text-muted-foreground">正在加载项目…</p>
        <div v-else-if="error" role="alert" class="text-sm text-destructive">
          {{ error }} <Button variant="secondary" size="sm" @click="loadProjects">重试</Button>
        </div>
        <Tabs
          v-else-if="workspaces.length"
          class="mt-4 gap-0"
          :model-value="selectedProject"
          @update:model-value="emit('select-project', Number($event))"
        >
          <TabsList
            class="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-0 pb-3"
            aria-label="选择 MCP 项目"
          >
            <TabsTrigger
              v-for="workspace in workspaces"
              :key="workspace.id"
              :value="String(workspace.id)"
              class="h-auto flex-none rounded-xl border-0 px-3 py-1.5 font-normal text-muted-foreground shadow-none hover:bg-muted/60 hover:text-foreground data-[state=active]:bg-muted data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {{ workspace.name }}
            </TabsTrigger>
          </TabsList>
          <TabsContent
            v-for="workspace in workspaces"
            :key="workspace.id"
            :value="String(workspace.id)"
            class="mt-8"
          >
            <McpPanel
              v-if="selectedProject === String(workspace.id)"
              :key="workspace.id"
              :target="{ scope: 'project', workspaceId: workspace.id }"
              :title="workspace.name"
            />
          </TabsContent>
        </Tabs>
        <p v-else class="py-8 text-center text-sm text-muted-foreground">暂无项目</p>
      </section>
    </main>
  </div>
</template>
