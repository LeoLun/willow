<script setup lang="ts">
import { computed, onBeforeMount } from "vue";
import { ChevronDown } from "lucide-vue-next";
import { useRoute } from "vue-router";
import { useWorkspaceStore } from "@/stores/workspace";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useRouter } from "vue-router";
const route = useRoute();
const router = useRouter();
const workspaceId = computed(() => route.query.workspaceId);
const workspaceStore = useWorkspaceStore();

const workspace = computed(() => {
  return workspaceStore.workspaceList.find((workspace) => workspace.id === Number(workspaceId.value));
});

onBeforeMount(async () => {
  await workspaceStore.fetchWorkspaceList();
});

</script>

<template>
  <div class="flex flex-col items-center justify-center h-full">
    <div class="text-4xl font-bold mb-5">开始工作</div>
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