<script setup lang="ts">
import type { Workspace, WorkspaceTemplate } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@willow/shadcn/components/ui/dialog";
import { Input } from "@willow/shadcn/components/ui/input";
import { Folder, FolderOpen, Check } from "lucide-vue-next";
import { ref, onBeforeMount } from "vue";
import { useRouter } from "vue-router";
import { electronAPI } from "@/lib/ipc";
import { useSessionStore } from "@/stores/session";
import { useWorkspaceStore } from "@/stores/workspace";

const emit = defineEmits<{
  close: [];
  created: [workspace: Workspace];
}>();

const name = ref("");
const loading = ref(false);
const path = ref("");
const templates = ref<WorkspaceTemplate[]>([]);
const selectedTemplateId = ref<string | null>(null);

const router = useRouter();

onBeforeMount(async () => {
  try {
    const res = await electronAPI.getWorkspaceTemplates();
    templates.value = res.templates || [];
  } catch (e) {
    console.error("Failed to load templates", e);
  }
});

async function handleSelectDirectory() {
  const result = await electronAPI.selectDirectory();
  if (result.selected && result.path) {
    path.value = result.path;
  }
}

async function handleSubmit() {
  const trimmed = name.value.trim();
  if (!trimmed || loading.value) return;
  loading.value = true;
  try {
    const { workspace, session, zipFileName } = await electronAPI.createWorkspace({
      name: trimmed,
      path: path.value.trim(),
      templateId: selectedTemplateId.value || undefined,
    });

    const workspaceStore = useWorkspaceStore();
    const sessionStore = useSessionStore();
    await workspaceStore.fetchWorkspaceList();

    emit("created", workspace);
    emit("close");

    if (session && zipFileName) {
      await sessionStore.fetchSessionList(workspaceStore.projectWorkspaceList.map((w) => w.id));
      workspaceStore.setWorkspaceExpanded(workspace.id, true);
      await router.push(`/${session.id}`);

      const separator = workspace.path.includes("\\") ? "\\" : "/";
      const filePath = `${workspace.path}${separator}${zipFileName}`;

      setTimeout(async () => {
        try {
          await electronAPI.sendMessage({
            sessionId: session.id,
            message: `解压[${zipFileName}](${filePath}) 包到当前目录`,
          });
        } catch (msgErr) {
          console.error("Failed to send automatic unzip message:", msgErr);
        }
      }, 500);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <DialogHeader>
    <DialogTitle>创建新工作空间</DialogTitle>
    <DialogDescription>输入工作空间名称并选择项目目录</DialogDescription>
  </DialogHeader>
  <form class="grid gap-4 py-4" @submit.prevent="handleSubmit">
    <div class="grid gap-4">
      <Input v-model="name" placeholder="工作空间名称" autofocus />
      <div class="grid gap-1.5">
        <label class="text-sm font-medium">项目目录（可选）</label>
        <Button
          v-if="!path"
          type="button"
          variant="outline"
          class="w-full"
          @click="handleSelectDirectory"
        >
          <FolderOpen class="size-4" />
          选择目录
        </Button>
        <button
          v-else
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-md border bg-secondary px-3"
          @click="handleSelectDirectory"
        >
          <Folder class="size-4 shrink-0" />
          <span class="truncate text-[13px]">{{ path }}</span>
        </button>
      </div>

      <!-- 模板选择区域 -->
      <div v-if="templates.length > 0" class="grid gap-1.5">
        <label class="text-sm font-medium">选择项目模板（可选）</label>
        <div class="grid max-h-[180px] grid-cols-2 gap-3 overflow-y-auto pr-1">
          <div
            v-for="tpl in templates"
            :key="tpl.id"
            class="relative flex cursor-pointer flex-col overflow-hidden rounded-lg border transition-all select-none"
            :style="{ borderRadius: 'var(--radius)' }"
            :class="
              selectedTemplateId === tpl.id
                ? 'border-primary bg-accent/60 shadow-sm'
                : 'border-border bg-card hover:bg-accent/30'
            "
            @click="selectedTemplateId = selectedTemplateId === tpl.id ? null : tpl.id"
          >
            <!-- 选中对勾角标 -->
            <div
              v-if="selectedTemplateId === tpl.id"
              class="absolute top-1.5 right-1.5 z-10 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
            >
              <Check class="size-2.5" />
            </div>

            <div
              v-if="tpl.previewUrl"
              class="mb-1.5 flex aspect-video w-full items-center justify-center overflow-hidden rounded border border-border bg-muted"
            >
              <img :src="tpl.previewUrl" alt="预览" class="h-full w-full object-cover" />
            </div>
            <div
              v-else
              class="mb-1.5 flex aspect-video w-full flex-col items-center justify-center gap-1 overflow-hidden rounded border border-border bg-muted text-muted-foreground"
            >
              <Folder class="size-5 text-muted-foreground/50" />
              <span class="text-[9px] text-muted-foreground/50">内置模板</span>
            </div>

            <div class="px-2.5 text-xs font-medium">{{ tpl.name }}</div>
            <div
              class="mt-0.5 mb-2.5 line-clamp-2 px-2.5 text-[11px] leading-snug text-muted-foreground"
            >
              {{ tpl.description }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <DialogFooter>
      <Button type="button" variant="outline" @click="emit('close')"> 取消 </Button>
      <Button type="submit" :disabled="!name.trim() || loading"> 创建 </Button>
    </DialogFooter>
  </form>
</template>
