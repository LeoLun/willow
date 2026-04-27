<script setup lang="ts">
import { ToggleGroup, ToggleGroupItem } from "@willow/shadcn/components/ui/toggle-group";
import { Monitor, Moon, Sun } from "lucide-vue-next";
import { useDarkMode } from "@/composables/useDarkMode";
import type { ThemeMode } from "@/composables/useDarkMode";

const { themeMode } = useDarkMode();

const themeModes: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "跟随系统", icon: Monitor },
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
];

function onThemeChange(value: string | string[]) {
  if (value) {
    themeMode.value = value as ThemeMode;
  }
}
</script>

<template>
  <div class="space-y-8">
    <h1 class="text-2xl font-semibold">外观</h1>

    <section class="space-y-3">
      <div class="space-y-1">
        <h2 class="text-base font-medium">外观</h2>
        <p class="text-sm text-muted-foreground">自定义应用的显示主题</p>
      </div>

      <div class="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div class="space-y-1">
          <span class="text-sm font-medium">主题模式</span>
          <p class="text-xs text-muted-foreground">选择浅色、深色或跟随系统</p>
        </div>

        <ToggleGroup
          type="single"
          :model-value="themeMode"
          variant="outline"
          @update:model-value="onThemeChange"
        >
          <ToggleGroupItem
            v-for="mode in themeModes"
            :key="mode.value"
            :value="mode.value"
            :aria-label="mode.label"
            class="gap-1.5 px-3"
          >
            <component :is="mode.icon" class="size-4" />
            <span class="text-xs">{{ mode.label }}</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </section>
  </div>
</template>
