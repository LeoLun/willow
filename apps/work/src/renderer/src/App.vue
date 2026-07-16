<script setup lang="ts">
import { useDarkMode } from "@/composables/useDarkMode";
import { DialogProvider } from "@/layout/dialog";

useDarkMode();
</script>

<template>
  <RouterView />
  <DialogProvider />
</template>
