<template>
  <div class="root">

  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { electronAPI } from "./lib/ipc";

onMounted(async () => {
  const { message } = await electronAPI.echo("hello");
  console.log(message);
});
</script>

<style scoped>

</style>