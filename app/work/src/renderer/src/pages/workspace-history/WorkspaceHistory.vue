<script setup lang="ts">
import type { Session } from "@shared/api";
import { ArrowLeft } from "lucide-vue-next";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { electronAPI } from "@/lib/ipc";
import { useWorkspaceStore } from "@/stores/workspace";

const PAGE_SIZE = 20;

const route = useRoute();
const router = useRouter();
const workspaceStore = useWorkspaceStore();

const workspaceId = computed(() => Number(route.params.workspaceId));
const workspace = computed(() =>
  workspaceStore.workspaceList.find((w) => w.id === workspaceId.value),
);

const sessions = ref<Session[]>([]);
const total = ref(-1);
const page = ref(1);
const loading = ref(false);
const sentinelRef = ref<HTMLDivElement | null>(null);

const initialized = computed(() => total.value >= 0);
const hasMore = computed(() => !initialized.value || sessions.value.length < total.value);

interface TimeGroup {
  label: string;
  sessions: Session[];
}

const groupedSessions = computed<TimeGroup[]>(() => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 86400000);

  const buckets: Record<string, Session[]> = {
    today: [],
    yesterday: [],
    sevenDays: [],
    thirtyDays: [],
    earlier: [],
  };

  for (const session of sessions.value) {
    const t = new Date(session.lastActiveAt).getTime();
    if (t >= todayStart.getTime()) {
      buckets.today.push(session);
    } else if (t >= yesterdayStart.getTime()) {
      buckets.yesterday.push(session);
    } else if (t >= sevenDaysAgo.getTime()) {
      buckets.sevenDays.push(session);
    } else if (t >= thirtyDaysAgo.getTime()) {
      buckets.thirtyDays.push(session);
    } else {
      buckets.earlier.push(session);
    }
  }

  const labels: [string, string][] = [
    ["today", "今天"],
    ["yesterday", "昨天"],
    ["sevenDays", "七天内"],
    ["thirtyDays", "三十天内"],
    ["earlier", "更早"],
  ];

  return labels
    .filter(([key]) => buckets[key].length > 0)
    .map(([key, label]) => ({ label, sessions: buckets[key] }));
});

async function loadMore() {
  if (loading.value || (initialized.value && !hasMore.value)) return;
  loading.value = true;
  try {
    const response = await electronAPI.getWorkspaceSessions({
      workspaceId: workspaceId.value,
      page: page.value,
      pageSize: PAGE_SIZE,
    });
    sessions.value.push(...response.sessions);
    total.value = response.total;
    page.value++;
  } finally {
    loading.value = false;
  }
}

function formatTime(date: Date) {
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${hours}:${minutes}`;
}

let observer: IntersectionObserver | null = null;

onMounted(async () => {
  if (workspaceStore.workspaceList.length === 0) {
    await workspaceStore.fetchWorkspaceList();
  }

  await loadMore();

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        loadMore();
      }
    },
    { threshold: 0.1 },
  );

  if (sentinelRef.value) {
    observer.observe(sentinelRef.value);
  }
});

onUnmounted(() => {
  observer?.disconnect();
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex items-center gap-1 border-b pl-3">
      <Button variant="ghost" size="icon" class="size-8" @click="router.back()">
        <ArrowLeft class="size-4" />
      </Button>
      <div class="text-base font-semibold">{{ workspace?.name ?? "工作空间" }} — 历史会话</div>
      <span v-if="initialized" class="text-sm text-muted-foreground">共 {{ total }} 条</span>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-4">
      <div class="mx-auto max-w-2xl">
        <template v-for="group in groupedSessions" :key="group.label">
          <div class="mt-4 mb-1 px-1 text-xs font-medium text-muted-foreground first:mt-0">
            {{ group.label }}
          </div>
          <div class="space-y-2">
            <div
              v-for="session in group.sessions"
              :key="session.id"
              class="flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-accent"
              @click="router.push(`/${session.id}`)"
            >
              <span class="min-w-0 flex-1 truncate">
                {{ session.title || "未命名会话" }}
              </span>
              <span class="ml-4 shrink-0 text-xs text-muted-foreground">
                {{ formatTime(session.lastActiveAt) }}
              </span>
            </div>
          </div>
        </template>

        <div
          v-if="initialized && sessions.length === 0 && !loading"
          class="py-12 text-center text-muted-foreground"
        >
          暂无会话记录
        </div>

        <div ref="sentinelRef" class="flex justify-center py-4">
          <span v-if="loading" class="text-sm text-muted-foreground">加载中...</span>
          <span v-else-if="!hasMore && sessions.length > 0" class="text-sm text-muted-foreground">
            已加载全部
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
