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
import { useWorkspaceSelection } from "@/composables/useWorkspaceSelection";

const {
  pinnedWorkspaces,
  unpinnedWorkspaces,
  workspaces,
  selectedWorkspaceValue,
  loadingWorkspaces,
  workspaceLoadError,
  selectWorkspace,
  handleWorkspaceSelectOpen,
} = useWorkspaceSelection();
</script>

<template>
  <div class="flex min-h-full flex-col justify-center p-8">
    <div class="mx-auto w-full max-w-3xl">
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
            class="rounded-xl border-transparent bg-transparent px-2 shadow-none hover:bg-muted"
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
            />
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
