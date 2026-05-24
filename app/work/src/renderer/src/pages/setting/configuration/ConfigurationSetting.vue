<script setup lang="ts">
import type { ModelConfig, TavilyKeyConfig } from "@shared/api";
import type { CheckUpdateResponse, UpdateStatusPayload } from "@shared/api";
import {
  CHECK_UPDATE,
  START_DOWNLOAD,
  INSTALL_UPDATE,
  UPDATE_STATUS_CHANGED,
} from "@shared/constants";
import { isBuiltinModel } from "@shared/model-config";
import { Badge, Button } from "@willow/shadcn";
import { Input } from "@willow/shadcn/components/ui/input";
import { Progress } from "@willow/shadcn/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@willow/shadcn/components/ui/tooltip";
import {
  Pencil,
  Plus,
  Star,
  Trash2,
  Key,
  Check,
  RefreshCw,
  Download,
  ArrowUpCircle,
  AlertCircle,
  CheckCircle,
} from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { computed, onBeforeMount, onMounted, onUnmounted, ref } from "vue";
import { useEventBus } from "@/composables/useEventBus";
import { useDialog } from "@/layout/dialog";
import { DeleteTavilyKey } from "@/layout/dialog/delete-tavily-key";
import { ModelKeyForm } from "@/layout/dialog/model-key-form";
import { TavilyKeyForm } from "@/layout/dialog/tavily-key-form";
import { electronAPI } from "@/lib/ipc";
import { useConfigStore } from "@/stores/config";

const { openDialog } = useDialog();
const configStore = useConfigStore();
const { modelList, tavilyKeyList } = storeToRefs(configStore);

const isSaving = ref(false);

const builtinModels = computed(() => modelList.value.filter((m) => isBuiltinModel(m.modelId)));
const nonBuiltinModels = computed(() => modelList.value.filter((m) => !isBuiltinModel(m.modelId)));

const deepSeekApiKey = computed(() => {
  const pro = builtinModels.value.find((m) => m.modelId === "deepseek-v4-pro");
  return pro?.apiKey || null;
});

const hasDeepSeekKey = computed(() => !!deepSeekApiKey.value);

// ─── 自动更新状态 ───
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
  }
  try {
    const res = await electronAPI.checkUpdate();
    hasUpdate.value = res.hasUpdate;
    latestVersion.value = res.latestVersion;
    currentVersion.value = res.currentVersion || "";
    updateType.value = res.updateType;
    releaseNotes.value = res.releaseNotes || "";
    publishDate.value = res.publishDate ? new Date(res.publishDate).toLocaleDateString() : "";
  } catch (e) {
    if (!silent) {
      console.error(e);
      updateError.value = e instanceof Error ? e.message : String(e);
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

onBeforeMount(() => {
  configStore.fetchModelList();
  configStore.fetchTavilyKeyList();
});

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

function handleAddModel() {
  openDialog(ModelKeyForm);
}

function handleEditModel() {
  openDialog(ModelKeyForm, {
    isEdit: true,
    initialApiKey: deepSeekApiKey.value || "",
  });
}

async function handleClearKey() {
  isSaving.value = true;
  try {
    await configStore.setDeepSeekApiKey("");
  } catch (e) {
    console.error(e);
  } finally {
    isSaving.value = false;
  }
}

async function handleSetDefault(model: ModelConfig) {
  await configStore.setDefaultModel(model.id);
}

function handleAddTavilyKey() {
  openDialog(TavilyKeyForm);
}

function handleEditTavilyKey(tavilyKey: TavilyKeyConfig) {
  openDialog(TavilyKeyForm, { tavilyKey });
}

function handleDeleteTavilyKey(tavilyKey: TavilyKeyConfig) {
  openDialog(DeleteTavilyKey, { tavilyKey });
}
</script>

<template>
  <div class="space-y-8">
    <h1 class="text-2xl font-semibold">配置</h1>

    <section class="space-y-3">
      <div class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-base font-medium">DeepSeek API Key</h2>
          <p class="text-sm text-muted-foreground">
            输入 API Key 后自动配置 DeepSeek V4 Pro 和 Flash 模型
          </p>
        </div>
      </div>

      <!-- 未配置 -->
      <div
        v-if="!hasDeepSeekKey"
        class="flex flex-col items-center justify-center gap-3 rounded-lg border p-6"
      >
        <p class="text-sm text-muted-foreground">未配置 DeepSeek 模型密钥</p>
        <Button size="sm" @click="handleAddModel">
          <Plus class="mr-1.5 size-4" />
          添加模型
        </Button>
      </div>

      <!-- 已配置 API Key -->
      <div v-else class="space-y-3 rounded-lg border p-4">
        <div class="flex items-center gap-2">
          <Check class="size-4 text-green-500" />
          <span class="text-sm font-medium">已配置 API Key</span>
          <Badge variant="outline" class="text-[10px]">{{ maskKey(deepSeekApiKey!) }}</Badge>
        </div>
        <p class="text-xs text-muted-foreground">可用模型：DeepSeek V4 Pro、DeepSeek V4 Flash</p>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" @click="handleEditModel">
            <Pencil class="mr-1 size-3.5" />
            修改
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-destructive hover:text-destructive"
            :disabled="isSaving"
            @click="handleClearKey"
          >
            <Trash2 class="mr-1 size-3.5" />
            清除
          </Button>
        </div>
      </div>

      <!-- 模型列表 -->
      <div v-if="builtinModels.length > 0" class="space-y-2">
        <div
          v-for="model in builtinModels"
          :key="model.id"
          class="group flex items-center justify-between gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50"
        >
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-medium">{{ model.name }}</span>
              <Badge v-if="model.isDefault" variant="default" class="text-[10px]"> 默认 </Badge>
            </div>
            <p class="truncate text-xs text-muted-foreground">
              {{ model.modelId }} · {{ model.baseUrl }}
            </p>
          </div>

          <Tooltip v-if="!model.isDefault">
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="size-8" @click="handleSetDefault(model)">
                <Star class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>设为默认</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <!-- 非内置模型（向后兼容） -->
      <div v-if="nonBuiltinModels.length > 0" class="space-y-2">
        <p class="text-xs text-muted-foreground">旧版模型</p>
        <div
          v-for="model in nonBuiltinModels"
          :key="model.id"
          class="flex items-center gap-3 rounded-lg border p-3"
        >
          <span class="truncate text-sm">{{ model.name }}</span>
          <Badge variant="outline" class="ml-2 text-[10px]">{{ model.provider }}</Badge>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <div class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-base font-medium">网络搜索 (Tavily)</h2>
          <p class="text-sm text-muted-foreground">管理 Tavily API Key，用于网络搜索功能</p>
        </div>
        <Button size="sm" class="gap-1.5" @click="handleAddTavilyKey">
          <Plus class="size-4" />
          添加 Key
        </Button>
      </div>

      <div v-if="tavilyKeyList.length === 0" class="rounded-lg border p-8 text-center">
        <p class="text-sm text-muted-foreground">暂无配置的 Tavily API Key</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="key in tavilyKeyList"
          :key="key.id"
          class="group flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
        >
          <div class="min-w-0 flex-1 space-y-2">
            <div class="flex items-center gap-2">
              <span class="font-mono text-sm">{{ maskKey(key.apiKey) }}</span>
              <Badge variant="outline" class="text-[10px]">
                {{ key.currentMonthUsage }} / {{ key.monthlyLimit }}
              </Badge>
            </div>
            <Progress
              :model-value="Math.min((key.currentMonthUsage / key.monthlyLimit) * 100, 100)"
              class="h-1.5"
            />
          </div>

          <div
            class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8"
                  @click="handleEditTavilyKey(key)"
                >
                  <Pencil class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>编辑</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8 text-destructive hover:text-destructive"
                  @click="handleDeleteTavilyKey(key)"
                >
                  <Trash2 class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>删除</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </section>

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
  </div>
</template>
