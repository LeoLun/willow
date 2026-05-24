<script setup lang="ts">
import type { UpdateStatusPayload } from "@shared/api";
import { START_DOWNLOAD, INSTALL_UPDATE, UPDATE_STATUS_CHANGED } from "@shared/constants";
import { Badge, Button } from "@willow/shadcn";
import { Progress } from "@willow/shadcn/components/ui/progress";
import { Sparkles, RefreshCw, Download, ArrowUpCircle, AlertCircle } from "lucide-vue-next";
import { onMounted, onUnmounted, ref } from "vue";
import { useEventBus } from "@/composables/useEventBus";
import { electronAPI } from "@/lib/ipc";

// ─── 自动更新与版本状态 ───
const updateStatus = ref<UpdateStatusPayload["status"]>("idle");
const updateProgress = ref(0);
const updateError = ref("");
const hasUpdate = ref(false);
const currentVersion = ref("");
const latestVersion = ref("");
const updateType = ref<"full" | "incremental" | undefined>(undefined);
const releaseNotes = ref("");
const publishDate = ref("");

const { addEventListener, removeEventListener } = useEventBus();

function handleUpdateStatusChanged(payload: UpdateStatusPayload) {
  updateStatus.value = payload.status;
  if (payload.progress !== undefined) {
    updateProgress.value = payload.progress;
  }
  if (payload.errorMsg) {
    updateError.value = payload.errorMsg;
  } else {
    updateError.value = "";
  }
}

onMounted(() => {
  addEventListener(UPDATE_STATUS_CHANGED, handleUpdateStatusChanged);
  handleCheckUpdate(true);
});

onUnmounted(() => {
  removeEventListener(UPDATE_STATUS_CHANGED, handleUpdateStatusChanged);
});

async function handleCheckUpdate(silent = false) {
  if (!silent) {
    updateError.value = "";
    // 如果是手动检查更新，强制将状态设为 checking
    updateStatus.value = "checking";
  }
  try {
    const res = await electronAPI.checkUpdate({ force: !silent });
    hasUpdate.value = res.hasUpdate;
    latestVersion.value = res.latestVersion;
    currentVersion.value = res.currentVersion || "";
    updateType.value = res.updateType;
    releaseNotes.value = res.releaseNotes || "";
    publishDate.value = res.publishDate ? new Date(res.publishDate).toLocaleDateString() : "";

    if (res.hasUpdate) {
      updateStatus.value = "available";
    } else {
      updateStatus.value = "idle";
    }
  } catch (e) {
    if (!silent) {
      updateStatus.value = "error";
      console.error(e);
      updateError.value = e instanceof Error ? e.message : String(e);
    } else {
      updateStatus.value = "idle";
    }
  }
}

async function handleStartDownload() {
  try {
    await electronAPI.startDownload();
  } catch (e) {
    console.error(e);
    updateError.value = e instanceof Error ? e.message : String(e);
  }
}

async function handleInstallUpdate() {
  try {
    await electronAPI.installUpdate();
  } catch (e) {
    console.error(e);
    updateError.value = e instanceof Error ? e.message : String(e);
  }
}
</script>

<template>
  <div class="space-y-8">
    <h1 class="text-2xl font-semibold">关于</h1>

    <!-- 应用品牌信息 -->
    <section class="space-y-3">
      <div class="space-y-1">
        <h2 class="text-base font-medium">应用信息</h2>
        <p class="text-sm text-muted-foreground">Willow 桌面应用基本信息</p>
      </div>

      <div class="flex items-center gap-4 rounded-lg border bg-card p-4">
        <div
          class="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/5"
        >
          <Sparkles class="size-7" />
        </div>
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-lg font-semibold tracking-tight">Willow</span>
            <Badge variant="outline" class="font-mono text-xs">{{
              currentVersion || "v0.0.1"
            }}</Badge>
          </div>
          <p class="text-xs text-muted-foreground">轻量级桌面智能工作台</p>
        </div>
      </div>
    </section>

    <!-- 系统更新 -->
    <section class="space-y-3">
      <div class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-base font-medium">系统更新</h2>
          <p class="text-sm text-muted-foreground">检查并获取 Willow 桌面端的最新版本</p>
        </div>
        <Button
          v-if="updateStatus === 'idle' || updateStatus === 'error' || updateStatus === 'available'"
          variant="outline"
          size="sm"
          class="gap-1.5"
          :disabled="updateStatus === 'checking'"
          @click="handleCheckUpdate(false)"
        >
          <RefreshCw class="size-3.5" :class="{ 'animate-spin': updateStatus === 'checking' }" />
          检查更新
        </Button>
      </div>

      <div class="space-y-4 rounded-lg border p-4">
        <!-- 基础版本展示 -->
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium">当前版本</span>
              <Badge variant="outline" class="font-mono text-xs">{{
                currentVersion || "v0.0.1"
              }}</Badge>
            </div>
            <p v-if="!hasUpdate && updateStatus === 'idle'" class="text-xs text-muted-foreground">
              当前已是最新版本
            </p>
            <p
              v-else-if="hasUpdate && updateStatus === 'available'"
              class="text-xs font-medium text-amber-500"
            >
              发现新版本: {{ latestVersion }}
            </p>
            <p
              v-else-if="updateStatus === 'checking'"
              class="animate-pulse text-xs text-muted-foreground"
            >
              正在检查最新版本...
            </p>
          </div>

          <!-- 更新状态与动作按钮 -->
          <div class="flex items-center gap-2">
            <!-- 发现新版本但未下载 -->
            <Button
              v-if="updateStatus === 'available'"
              size="sm"
              class="gap-1.5"
              @click="handleStartDownload"
            >
              <Download class="size-3.5" />
              {{ updateType === "incremental" ? "立即更新" : "下载更新安装包" }}
            </Button>

            <!-- 下载完成待安装 -->
            <Button
              v-if="updateStatus === 'downloaded'"
              size="sm"
              variant="default"
              class="gap-1.5 bg-green-600 text-white hover:bg-green-700"
              @click="handleInstallUpdate"
            >
              <ArrowUpCircle class="size-3.5" />
              {{ updateType === "incremental" ? "重启并更新" : "打开 DMG 并安装" }}
            </Button>
          </div>
        </div>

        <!-- 标签展示更新类型 -->
        <div v-if="hasUpdate && updateType" class="flex gap-2">
          <Badge
            v-if="updateType === 'incremental'"
            variant="secondary"
            class="rounded border-none bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
          >
            增量热更新 (重启即用)
          </Badge>
          <Badge
            v-else
            variant="secondary"
            class="rounded border-none bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
          >
            大版本整包更新 (DMG 拖拽覆盖)
          </Badge>
        </div>

        <!-- 进度条 -->
        <div v-if="updateStatus === 'downloading'" class="space-y-2">
          <div class="flex justify-between text-xs text-muted-foreground">
            <span>正在下载更新包...</span>
            <span class="font-mono">{{ updateProgress }}%</span>
          </div>
          <Progress :model-value="updateProgress" class="h-1.5" />
        </div>

        <!-- 错误提示 -->
        <div
          v-if="updateError"
          class="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive"
        >
          <AlertCircle class="mt-0.5 size-4 shrink-0" />
          <div class="space-y-1">
            <span class="font-semibold">更新出错</span>
            <p>{{ updateError }}</p>
          </div>
        </div>

        <!-- 更新日志日志展示 -->
        <div v-if="hasUpdate && releaseNotes" class="mt-2 space-y-1 rounded bg-muted/30 p-3">
          <div class="text-xs font-semibold text-muted-foreground">
            更新日志 ({{ publishDate }})
          </div>
          <div
            class="max-h-40 overflow-y-auto pr-1 font-sans text-sm whitespace-pre-wrap text-foreground"
          >
            {{ releaseNotes }}
          </div>
        </div>
      </div>
    </section>

    <!-- 版权声明 -->
    <footer class="border-t pt-8 text-center text-xs text-muted-foreground">
      <p>© 2026 Willow Project. All rights reserved.</p>
    </footer>
  </div>
</template>
