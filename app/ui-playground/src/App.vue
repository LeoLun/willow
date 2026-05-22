<script setup lang="ts">
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@willow/shadcn";
import { computed, ref, onMounted, onUnmounted } from "vue";
import { demoRegistry } from "./demos/demo-registry";
import FloatingBallDemo from "./demos/scenes/FloatingBallDemo.vue";

const selectedDemoId = ref(demoRegistry[0]?.id ?? "");

const groupedDemos = computed(() => {
  const groups = new Map<string, typeof demoRegistry>();

  for (const demo of demoRegistry) {
    const existing = groups.get(demo.group);
    if (existing) {
      existing.push(demo);
    } else {
      groups.set(demo.group, [demo]);
    }
  }

  return Array.from(groups.entries()).map(([group, demos]) => ({ group, demos }));
});

const selectedDemo = computed(
  () => demoRegistry.find((demo) => demo.id === selectedDemoId.value) ?? demoRegistry[0],
);

const currentHash = ref(window.location.hash);

const updateHash = () => {
  currentHash.value = window.location.hash;
};

onMounted(() => {
  window.addEventListener("hashchange", updateHash);
});

onUnmounted(() => {
  window.removeEventListener("hashchange", updateHash);
});
</script>

<template>
  <div v-if="currentHash === '#/floating-ball'" class="h-screen w-screen overflow-hidden">
    <FloatingBallDemo />
  </div>
  <div v-else class="min-h-screen bg-background text-foreground">
    <div class="mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-4 lg:px-6 lg:py-6">
      <main class="mt-4 grid flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside class="rounded-3xl border border-border bg-sidebar px-4 py-4 shadow-sm">
          <div class="mb-4 px-2">
            <h2 class="text-sm font-semibold text-foreground">调试场景</h2>
            <p class="mt-1 text-sm leading-6 text-muted-foreground">
              每个场景只表达一个主要视觉目的，方便快速定位样式问题。
            </p>
            <a
              href="#/floating-ball"
              class="mt-3 flex items-center justify-center gap-1.5 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-center text-xs font-semibold text-indigo-400 transition-colors hover:bg-indigo-500/20"
            >
              打开悬浮球 LUI 独立调试页 →
            </a>
          </div>

          <div class="space-y-4">
            <section v-for="group in groupedDemos" :key="group.group">
              <h3
                class="px-2 text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase"
              >
                {{ group.group }}
              </h3>
              <div class="mt-2 space-y-1">
                <button
                  v-for="demo in group.demos"
                  :key="demo.id"
                  type="button"
                  class="w-full rounded-2xl border px-3 py-3 text-left transition-colors"
                  :class="
                    demo.id === selectedDemo.id
                      ? 'border-primary/30 bg-primary/8 text-foreground'
                      : 'border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground'
                  "
                  @click="selectedDemoId = demo.id"
                >
                  <div class="text-sm font-medium">{{ demo.title }}</div>
                  <div class="mt-1 text-xs leading-5">{{ demo.description }}</div>
                </button>
              </div>
            </section>
          </div>
        </aside>

        <Card class="rounded-3xl px-4 py-4 shadow-sm lg:px-6 lg:py-6">
          <CardHeader class="mb-5 border-b border-border px-0 pb-4">
            <CardTitle class="text-xl">{{ selectedDemo.title }}</CardTitle>
            <CardDescription class="max-w-3xl leading-6">
              {{ selectedDemo.description }}
            </CardDescription>
          </CardHeader>

          <CardContent class="px-0">
            <component :is="selectedDemo.component" />
          </CardContent>
        </Card>
      </main>
    </div>
  </div>
</template>
