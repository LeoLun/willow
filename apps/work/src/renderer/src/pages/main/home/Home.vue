<script setup lang="ts">
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@willow/shadcn/components/ui/select";
import { Folder } from "lucide-vue-next";
import { onMounted } from "vue";
import { AxolotlMascot } from "@/components/mascot/Mascot";
import { useAppUpdate } from "@/composables/useAppUpdate";
import { useWorkspaceSelection } from "@/composables/useWorkspaceSelection";

const {
  pinnedWorkspaces,
  unpinnedWorkspaces,
  workspaces,
  selectedWorkspace,
  selectedWorkspaceValue,
  loadingWorkspaces,
  workspaceLoadError,
  selectWorkspace,
  handleWorkspaceSelectOpen,
} = useWorkspaceSelection();

const { checkForUpdate, confirmUpdateBoot } = useAppUpdate();
onMounted(async () => {
  await confirmUpdateBoot();
  await checkForUpdate();
});
</script>

<template>
  <div class="flex min-h-full flex-col justify-center p-8">
    <div class="mx-auto w-full max-w-3xl">
      <header class="mb-0 flex items-center justify-center gap-5">
        <AxolotlMascot
          :size="60"
          expression="attentive"
          aria-label="Willow 吉祥物"
          class="shrink-0"
        />
        <div class="flex flex-col items-start gap-2">
          <h1 class="text-3xl font-medium tracking-tight">让 Willow 来帮你完成任务</h1>
        </div>
      </header>

      <div class="mb-3 flex min-h-8 items-center gap-2">
        <Select
          :model-value="selectedWorkspaceValue"
          :disabled="workspaces.length === 0"
          @update:model-value="selectWorkspace"
          @update:open="handleWorkspaceSelectOpen"
        >
          <SelectTrigger
            aria-label="选择项目"
            size="sm"
            class="dark:bg-unset cursor-pointer rounded-xl border-transparent bg-transparent px-2 shadow-none hover:bg-muted"
          >
            <Folder class="size-4" aria-hidden="true" />
            <SelectValue
              :placeholder="
                loadingWorkspaces
                  ? '正在读取项目…'
                  : workspaceLoadError
                    ? '无法读取项目'
                    : '暂无项目'
              "
            >
              {{ selectedWorkspace?.name }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start" class="w-64 max-w-64 min-w-64">
            <SelectGroup v-if="pinnedWorkspaces.length > 0">
              <SelectLabel>置顶</SelectLabel>
              <SelectItem
                v-for="workspace in pinnedWorkspaces"
                :key="workspace.id"
                :value="String(workspace.id)"
                class="overflow-hidden [&_[data-slot=select-item-text]]:truncate"
              >
                {{ workspace.name }}
              </SelectItem>
            </SelectGroup>
            <SelectGroup v-if="unpinnedWorkspaces.length > 0">
              <SelectLabel>项目</SelectLabel>
              <SelectItem
                v-for="workspace in unpinnedWorkspaces"
                :key="workspace.id"
                :value="String(workspace.id)"
                class="overflow-hidden [&_[data-slot=select-item-text]]:truncate"
              >
                {{ workspace.name }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <span v-if="workspaceLoadError" class="text-xs text-destructive" role="alert">
          {{ workspaceLoadError }}
        </span>
      </div>

      <slot />
    </div>
  </div>
</template>
