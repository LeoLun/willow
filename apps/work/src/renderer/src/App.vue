<script setup lang="ts">
import { DialogProvider } from "@/components/dialog";
import { useDarkMode } from "@/composables/useDarkMode";
import { useMcpLogin } from "@/composables/useMcpLogin";

useDarkMode();
useMcpLogin();
</script>

<template>
  <RouterView />
  <DialogProvider />
</template>
