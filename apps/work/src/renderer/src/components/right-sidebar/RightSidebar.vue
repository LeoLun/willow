<script setup lang="ts">
defineProps<{
  id: string;
  workspaceId?: number;
}>();
</script>

<template>
  <aside
    :id="id"
    class="min-h-0 min-w-0 overflow-auto"
    data-slot="chat-right-sidebar"
    :data-workspace-id="workspaceId"
    aria-label="右侧边栏"
  >
    <div>右侧边栏区域</div>
  </aside>
</template>
