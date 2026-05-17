<script setup lang="ts">
import { Label } from "@willow/shadcn/components/ui/label";
import { Switch } from "@willow/shadcn/components/ui/switch";
import { onMounted, ref, watch } from "vue";

const enabled = ref(false);
const initialized = ref(false);

onMounted(async () => {
  try {
    const configResponse = await window.electronAPI.getFloatingBallConfig();
    enabled.value = configResponse.config.enabled;
    // Set initialized after a short delay to avoid catching the initial value set
    setTimeout(() => {
      initialized.value = true;
    }, 100);
  } catch (error) {
    console.error("[Renderer] Failed to get floating ball config:", error);
  }
});

watch(enabled, async (newVal, oldVal) => {
  if (initialized.value) {
    await window.electronAPI.setFloatingBallEnabled({ enabled: newVal });
  }
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <h1 class="text-xl font-medium tracking-tight">悬浮球</h1>
      <p class="text-sm text-muted-foreground">管理悬浮球快捷入口</p>
    </div>
    <div class="flex items-center space-x-2">
      <Switch id="floating-ball-enabled" v-model="enabled" />
      <Label for="floating-ball-enabled">开启悬浮球</Label>
    </div>
  </div>
</template>
