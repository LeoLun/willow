<script setup lang="ts">
import { Button } from "@willow/shadcn/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@willow/shadcn/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-vue-next";
import { computed, onBeforeMount } from "vue";
import { useRoute } from "vue-router";
import { useRouter } from "vue-router";
import { useWorkspaceStore } from "@/stores/workspace";
const route = useRoute();
const router = useRouter();
const workspaceId = computed(() => route.query.workspaceId);
const workspaceStore = useWorkspaceStore();

const workspace = computed(() => {
  return workspaceStore.workspaceList.find(
    (workspace) => workspace.id === Number(workspaceId.value),
  );
});

onBeforeMount(async () => {
  await workspaceStore.fetchWorkspaceList();
});
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center">
    <div class="mb-5 text-4xl font-bold">开始工作</div>
    <DropdownMenu v-if="workspace">
      <DropdownMenuTrigger>
        <Button variant="ghost">
          {{ workspace.name }}
          <ChevronDown class="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuItem
          v-for="workspace in workspaceStore.workspaceList"
          :key="workspace.id"
          @click="router.push(`/?workspaceId=${workspace.id}`)"
        >
          {{ workspace.name }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
