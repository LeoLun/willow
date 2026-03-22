<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";


const route = useRoute();

const workspaceId = computed(() => route.query.workspaceId);

</script>

<template>
  <div>
    <h1>Workspace</h1>
    <p>workspaceId: {{ workspaceId }}</p>
  </div>
</template>

<style scoped>

</style>