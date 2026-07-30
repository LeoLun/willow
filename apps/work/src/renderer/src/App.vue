<script setup lang="ts">
import { DialogProvider } from "@/components/dialog";
import { useDarkMode } from "@/composables/useDarkMode";

useDarkMode();
</script>

<template>
  <RouterView />
  <DialogProvider />
</template>
