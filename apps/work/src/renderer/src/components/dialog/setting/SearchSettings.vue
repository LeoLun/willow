<script setup lang="ts">
import type { TavilyUsageInfo } from "@shared/api";
import { Badge } from "@willow/shadcn/components/ui/badge";
import { Progress } from "@willow/shadcn/components/ui/progress";
import { LoaderCircle, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-vue-next";
import { computed, onMounted, ref, shallowRef } from "vue";
import { useDialog } from "@/components/dialog";
import { Button } from "@/components/ui/button";
import { electronAPI } from "@/lib/ipc";
import TavilyConnectDialog from "./TavilyConnectDialog.vue";

const numberFormatter = new Intl.NumberFormat("zh-CN");

const configured = ref(false);
const loading = ref(true);
const deleting = ref(false);
const refreshing = ref(false);
const errorMessage = ref("");
const usage = shallowRef<TavilyUsageInfo>();

const { dialogState, openDialog } = useDialog();

const usagePercentage = computed(() => {
  const value = usage.value;
  if (!value || value.planLimit <= 0) return 0;
  return Math.min(100, Math.max(0, (value.planUsage / value.planLimit) * 100));
});

async function loadSettings(refresh = false): Promise<void> {
  if (refresh) refreshing.value = true;
  else loading.value = true;
  errorMessage.value = "";
  try {
    const response = await electronAPI.getTavilySettings();
    configured.value = response.configured;
    usage.value = response.usage;
    if (response.configured && !response.usage) {
      errorMessage.value = response.usageError ?? "Tavily 已配置，但暂时无法读取用量。";
    }
  } catch {
    errorMessage.value = "无法读取 Tavily 设置，请重试。";
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

function openTavilyConnection(mode: "connect" | "edit"): void {
  const settingDialog = dialogState.value;
  if (!settingDialog) return;

  const returnToSearchSettings = () => {
    openDialog(
      settingDialog.component,
      { ...settingDialog.props, initialTab: "search" },
      { contentClass: settingDialog.contentClass },
    );
  };

  openDialog(
    TavilyConnectDialog,
    {
      mode,
      onBack: returnToSearchSettings,
      onSaved: returnToSearchSettings,
    },
    { contentClass: "sm:max-w-[425px]" },
  );
}

async function deleteApiKey(): Promise<void> {
  if (deleting.value) return;
  deleting.value = true;
  errorMessage.value = "";
  try {
    await electronAPI.deleteTavilyApiKey();
    configured.value = false;
    usage.value = undefined;
  } catch {
    errorMessage.value = "删除 Tavily API Key 失败，请重试。";
  } finally {
    deleting.value = false;
  }
}

onMounted(() => void loadSettings());
</script>

<template>
  <section class="h-full overflow-y-auto pr-2" aria-labelledby="search-settings-heading">
    <div class="max-w-2xl pb-8">
      <header>
        <h2 id="search-settings-heading" class="text-lg font-semibold tracking-tight">网络搜索</h2>
        <p class="mt-1.5 text-sm text-muted-foreground">
          连接 Tavily，让 Willow 获取实时、可靠的网络信息。
        </p>
      </header>

      <div v-if="loading" class="mt-6 animate-pulse rounded-xl border bg-muted/20 px-3 py-3">
        <div class="flex items-center gap-3">
          <div class="size-9 rounded-lg bg-muted" />
          <div class="flex-1 space-y-2">
            <div class="h-4 w-28 rounded bg-muted" />
            <div class="h-3 w-52 rounded bg-muted/70" />
          </div>
          <div class="h-8 w-20 rounded-full bg-muted" />
        </div>
      </div>

      <div v-else class="mt-6 space-y-4">
        <section aria-labelledby="tavily-provider-heading">
          <div class="flex items-center gap-2 rounded-xl border bg-muted/20 px-3 py-3">
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground"
              aria-hidden="true"
            >
              <Search class="size-5" />
            </span>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2 text-sm">
                <h3 id="tavily-provider-heading" class="font-medium">Tavily</h3>
                <Badge v-if="configured" variant="outline" class="text-muted-foreground">
                  API 密钥
                </Badge>
              </div>
              <p v-if="!configured" class="mt-1 truncate text-xs text-muted-foreground">
                使用 Tavily API Key 连接
              </p>
              <p v-if="errorMessage" class="mt-1 text-xs text-destructive" role="alert">
                {{ errorMessage }}
              </p>
            </div>

            <Button v-if="!configured" variant="ghost" @click="openTavilyConnection('connect')">
              <Plus aria-hidden="true" />
              连接
            </Button>
            <div v-else class="flex shrink-0 items-center gap-1">
              <button
                type="button"
                class="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                :disabled="deleting"
                aria-label="修改 Tavily API Key"
                title="修改 API Key"
                @click="openTavilyConnection('edit')"
              >
                <Pencil class="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                :disabled="deleting"
                :aria-busy="deleting || undefined"
                aria-label="删除 Tavily API Key 并断开连接"
                title="断开连接"
                @click="deleteApiKey"
              >
                <LoaderCircle v-if="deleting" class="size-4 animate-spin" aria-hidden="true" />
                <Trash2 v-else class="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        <section
          v-if="configured"
          class="rounded-2xl border bg-card/70 p-5 shadow-sm"
          aria-labelledby="tavily-usage-heading"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <h3 id="tavily-usage-heading" class="text-sm font-semibold">本月用量</h3>
                <span
                  v-if="usage"
                  class="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  {{ usage.currentPlan }}
                </span>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ usage ? "当前密钥的月度 Credit 使用情况" : "暂时无法读取套餐信息" }}
              </p>
            </div>
            <button
              type="button"
              class="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              :disabled="refreshing"
              aria-label="刷新 Tavily 用量"
              @click="loadSettings(true)"
            >
              <RefreshCw class="size-4" :class="refreshing ? 'animate-spin' : ''" />
            </button>
          </div>

          <div v-if="usage" class="mt-5">
            <div class="mb-3 flex items-end justify-between gap-4">
              <div>
                <span class="text-3xl font-semibold tracking-tight tabular-nums">
                  {{ numberFormatter.format(usage.planUsage) }}
                </span>
                <span class="ml-1.5 text-sm text-muted-foreground">已用</span>
              </div>
              <span class="pb-1 text-xs text-muted-foreground tabular-nums">
                {{ numberFormatter.format(usage.planLimit) }} Credits
              </span>
            </div>
            <Progress
              :model-value="usagePercentage"
              class="h-1.5 bg-muted"
              aria-label="Tavily 月度用量"
            />
            <p class="mt-2 text-right text-xs text-muted-foreground tabular-nums">
              {{ Math.round(usagePercentage) }}%
            </p>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>
