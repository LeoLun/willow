<script setup lang="ts">
import { Button } from "@willow/shadcn/components/ui/button";
import { ArrowLeft, Settings2, Sun, Circle, Info } from "lucide-vue-next";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const navItems = [
  {
    label: "外观",
    icon: Sun,
    routeName: "settingAppearance",
    to: "/setting/appearance",
  },
  {
    label: "配置",
    icon: Settings2,
    routeName: "settingConfiguration",
    to: "/setting/configuration",
  },
  {
    label: "关于",
    icon: Info,
    routeName: "settingAbout",
    to: "/setting/about",
  },
];

const currentRouteName = computed(() => String(route.name ?? ""));
const returnTarget = computed(() => {
  const from = route.query.from;
  if (typeof from === "string" && from && !from.startsWith("/setting")) {
    return from;
  }
  return "/";
});
const settingsQuery = computed(() => {
  const from = route.query.from;
  return typeof from === "string" && from ? { from } : undefined;
});

function isActive(routeName: string) {
  return currentRouteName.value === routeName;
}

function goBackToApp() {
  router.push(returnTarget.value);
}
</script>

<template>
  <div class="relative flex h-full min-h-0 bg-background">
    <!-- 顶部拖拽区域 -->
    <div class="drag-region absolute top-0 right-0 left-0 z-50 h-10"></div>

    <aside class="flex w-64 shrink-0 flex-col gap-2 border-r bg-muted/20 px-2 pt-10 pb-6">
      <Button
        variant="ghost"
        size="sm"
        class="h-7 justify-start gap-2 px-2 text-muted-foreground hover:text-foreground"
        @click="goBackToApp"
      >
        <ArrowLeft class="size-4" aria-hidden="true" />
        返回应用
      </Button>

      <nav class="space-y-1">
        <Button
          v-for="item in navItems"
          :key="item.routeName"
          variant="ghost"
          size="sm"
          class="h-7 w-full justify-start gap-2 px-2"
          :class="
            isActive(item.routeName)
              ? 'bg-muted font-semibold text-foreground hover:bg-muted'
              : 'font-medium text-foreground hover:bg-muted/60'
          "
          @click="router.push({ path: item.to, query: settingsQuery })"
        >
          <component :is="item.icon" class="size-4" aria-hidden="true" />
          {{ item.label }}
        </Button>
      </nav>
    </aside>

    <main class="min-w-0 flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-[760px] px-10 py-[72px]">
        <RouterView />
      </div>
    </main>
  </div>
</template>
