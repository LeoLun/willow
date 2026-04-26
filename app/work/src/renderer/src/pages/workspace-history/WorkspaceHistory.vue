<script setup lang="ts">
import type { Session } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import { ArrowLeft } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import MainTitle from "@/components/base/MainTitle.vue";
import { electronAPI } from "@/lib/ipc";
import { useSessionStore } from "@/stores/session";
import { useWorkspaceStore } from "@/stores/workspace";

const PAGE_SIZE = 20;

const route = useRoute();
const router = useRouter();
const sessionStore = useSessionStore();
const workspaceStore = useWorkspaceStore();
const { lastDeletedSession } = storeToRefs(sessionStore);

const workspaceId = computed(() => {
  const value = Number(route.params.workspaceId);
  return Number.isNaN(value) ? 0 : value;
});
const workspace = computed(() =>
  workspaceStore.workspaceList.find((w) => w.id === workspaceId.value),
);

const sessions = ref<Session[]>([]);
const total = ref(-1);
const page = ref(1);
const loading = ref(false);
const sentinelRef = ref<HTMLDivElement | null>(null);
let loadToken = 0;

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

function resetHistoryState() {
  sessions.value = [];
  total.value = -1;
  page.value = 1;
  loading.value = false;
}

async function loadMore(expectedWorkspaceId = workspaceId.value, expectedToken = loadToken) {
  if (!expectedWorkspaceId || loading.value || (initialized.value && !hasMore.value)) return;
  loading.value = true;
  const nextPage = page.value;
  try {
    const response = await electronAPI.getWorkspaceSessions({
      workspaceId: expectedWorkspaceId,
      page: nextPage,
      pageSize: PAGE_SIZE,
    });
    if (expectedToken !== loadToken || expectedWorkspaceId !== workspaceId.value) {
      return;
    }
    sessions.value.push(...response.sessions);
    total.value = response.total;
    page.value = nextPage + 1;
  } finally {
    if (expectedToken === loadToken) {
      loading.value = false;
    }
  }
}

async function reloadHistory() {
  const targetWorkspaceId = workspaceId.value;
  loadToken++;
  const currentToken = loadToken;
  resetHistoryState();
  await loadMore(targetWorkspaceId, currentToken);
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

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        void loadMore();
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

watch(
  workspaceId,
  () => {
    void reloadHistory();
  },
  { immediate: true },
);

watch(lastDeletedSession, (session) => {
  if (!session || session.workspaceId !== workspaceId.value) {
    return;
  }
  void reloadHistory();
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <MainTitle class="pl-3">
      <div class="text-sm font-semibold">历史会话 - {{ workspace?.name ?? "工作空间" }}</div>
    </MainTitle>

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
