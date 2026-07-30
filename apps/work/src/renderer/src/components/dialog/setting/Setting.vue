<script setup lang="ts">
import type { GetAppInfoResponse, ModelConfig, ProviderInfo, UserConfigInfo } from "@shared/api";
import { Badge } from "@willow/shadcn/components/ui/badge";
import { DialogDescription, DialogTitle } from "@willow/shadcn/components/ui/dialog";
import { Input } from "@willow/shadcn/components/ui/input";
import { Label } from "@willow/shadcn/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@willow/shadcn/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@willow/shadcn/components/ui/toggle-group";
import {
  ChartBar,
  CircleAlert,
  Cpu,
  DatabaseZap,
  Info,
  Laptop,
  Globe2,
  Moon,
  Plus,
  Search,
  Settings2,
  Sun,
  X,
} from "lucide-vue-next";
import { computed, onMounted, ref, shallowRef } from "vue";
import { useDialog } from "@/components/dialog";
import { Button } from "@/components/ui/button";
import { useDarkMode } from "@/composables/useDarkMode";
import { electronAPI } from "@/lib/ipc";
import appIconUrl from "../../../../../../assets/icons/icon.png";
import { getAvailableProviders, getConnectedProviders } from "./provider-display";
import ProviderConnectDialog from "./ProviderConnectDialog.vue";
import ProviderMark from "./ProviderMark.vue";
import SearchSettings from "./SearchSettings.vue";
import Statistics from "./Statistics.vue";

type SettingTab = "general" | "providers" | "models" | "search" | "statistics" | "about";

const props = withDefaults(
  defineProps<{
    initialTab?: SettingTab;
  }>(),
  {
    initialTab: "general",
  },
);

const tabs = [
  { id: "general" as const, label: "常规", icon: Settings2 },
  { id: "providers" as const, label: "提供商", icon: Cpu },
  { id: "models" as const, label: "模型", icon: DatabaseZap },
  { id: "search" as const, label: "搜索", icon: Globe2 },
  { id: "statistics" as const, label: "统计", icon: ChartBar },
  { id: "about" as const, label: "关于", icon: Info },
];

const themeOptions = [
  { id: "system" as const, label: "自动", description: "跟随系统外观", icon: Laptop },
  { id: "light" as const, label: "浅色", description: "始终使用浅色", icon: Sun },
  { id: "dark" as const, label: "深色", description: "始终使用深色", icon: Moon },
];

const activeTab = ref<SettingTab>(props.initialTab);
const hasVisitedSearch = ref(props.initialTab === "search");
const providers = shallowRef<ProviderInfo[]>([]);
const configuredProviderIds = shallowRef<ReadonlySet<string>>(new Set());
const appInfo = ref<GetAppInfoResponse>();
const loadingProviders = ref(true);
const providerLoadError = ref(false);
const searchQuery = ref("");
const disconnectingProviderIds = shallowRef<ReadonlySet<string>>(new Set());
const providerActionErrors = shallowRef<Readonly<Record<string, string>>>({});
const userConfig = ref<UserConfigInfo>({});
const loadingUserConfig = ref(true);
const savingUserConfig = ref(false);
const userConfigError = ref("");

const { themeMode } = useDarkMode();
const { dialogState, openDialog } = useDialog();

const connectedProviders = computed(() =>
  getConnectedProviders(providers.value, configuredProviderIds.value),
);
const unfilteredAvailableProviders = computed(() =>
  getAvailableProviders(providers.value, configuredProviderIds.value, ""),
);
const availableProviders = computed(() =>
  getAvailableProviders(providers.value, configuredProviderIds.value, searchQuery.value),
);
const configuredModelProviders = computed(() =>
  providers.value.filter(
    (provider) => configuredProviderIds.value.has(provider.id) && provider.models.length > 0,
  ),
);

function updateTheme(value: unknown) {
  if (value === "system" || value === "light" || value === "dark") {
    themeMode.value = value;
  }
}

function changeTab(tab: SettingTab) {
  activeTab.value = tab;
  if (tab === "search") hasVisitedSearch.value = true;
  providerActionErrors.value = {};
}

async function loadProviders() {
  loadingProviders.value = true;
  providerLoadError.value = false;
  providerActionErrors.value = {};
  try {
    const [catalog, configured] = await Promise.all([
      electronAPI.getProviderCatalog(),
      electronAPI.getConfiguredProviders(),
    ]);
    providers.value = catalog.providers;
    configuredProviderIds.value = new Set(configured.providerIds);
  } catch {
    providers.value = [];
    configuredProviderIds.value = new Set();
    providerLoadError.value = true;
  } finally {
    loadingProviders.value = false;
  }
}

async function loadUserConfig() {
  loadingUserConfig.value = true;
  userConfigError.value = "";
  try {
    userConfig.value = await electronAPI.getUserConfig();
  } catch {
    userConfig.value = {};
    userConfigError.value = "无法读取模型配置，请重试。";
  } finally {
    loadingUserConfig.value = false;
  }
}

function encodeModel(model: ModelConfig | undefined): string | undefined {
  return model ? JSON.stringify([model.providerId, model.modelId]) : undefined;
}

function decodeModel(value: unknown): ModelConfig | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "string" &&
      typeof parsed[1] === "string"
    ) {
      return { providerId: parsed[0], modelId: parsed[1] };
    }
  } catch {
    // Select values are generated locally; ignore malformed values.
  }
  return undefined;
}

async function updateModelConfig(kind: "largeModel" | "smallModel", value: unknown) {
  const model = decodeModel(value);
  if (!model || savingUserConfig.value) return;

  savingUserConfig.value = true;
  userConfigError.value = "";
  try {
    userConfig.value = await electronAPI.setUserConfig({
      [kind]: model,
    });
  } catch {
    userConfigError.value = "保存模型配置失败，请重试。";
  } finally {
    savingUserConfig.value = false;
  }
}

function openProviderConnection(provider: ProviderInfo) {
  const settingDialog = dialogState.value;
  if (!settingDialog) return;

  const returnToProviders = () => {
    openDialog(
      settingDialog.component,
      { ...settingDialog.props, initialTab: "providers" },
      { contentClass: settingDialog.contentClass },
    );
  };

  openDialog(
    ProviderConnectDialog,
    {
      provider,
      onBack: returnToProviders,
      onConnected: returnToProviders,
    },
    { contentClass: "sm:max-w-[425px]" },
  );
}

async function disconnectProvider(providerId: string) {
  if (disconnectingProviderIds.value.has(providerId)) return;
  const nextDisconnectingIds = new Set(disconnectingProviderIds.value);
  nextDisconnectingIds.add(providerId);
  disconnectingProviderIds.value = nextDisconnectingIds;
  const remainingErrors = { ...providerActionErrors.value };
  delete remainingErrors[providerId];
  providerActionErrors.value = remainingErrors;
  try {
    await electronAPI.deleteCredential({ providerId });
    const nextConfiguredIds = new Set(configuredProviderIds.value);
    nextConfiguredIds.delete(providerId);
    configuredProviderIds.value = nextConfiguredIds;
  } catch {
    providerActionErrors.value = {
      ...providerActionErrors.value,
      [providerId]: "断开连接失败，请重试。",
    };
  } finally {
    const remainingDisconnectingIds = new Set(disconnectingProviderIds.value);
    remainingDisconnectingIds.delete(providerId);
    disconnectingProviderIds.value = remainingDisconnectingIds;
  }
}

onMounted(async () => {
  const [, , appInfoResult] = await Promise.allSettled([
    loadProviders(),
    loadUserConfig(),
    electronAPI.getAppInfo(),
  ]);
  if (appInfoResult.status === "fulfilled") appInfo.value = appInfoResult.value;
});
</script>

<template>
  <div class="grid h-full min-h-0 grid-cols-[180px_minmax(0,1fr)] bg-background">
    <DialogTitle class="sr-only">设置</DialogTitle>
    <DialogDescription class="sr-only">
      配置应用外观、AI 提供商、模型、网络搜索、统计和应用信息。
    </DialogDescription>

    <aside class="border-r bg-muted/35 p-3 pt-5">
      <div class="px-3 pb-4 text-base font-semibold">设置</div>
      <nav class="space-y-1" role="tablist" aria-label="设置分类" aria-orientation="vertical">
        <button
          v-for="tab in tabs"
          :id="`setting-tab-${tab.id}`"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.id"
          :aria-controls="`setting-panel-${tab.id}`"
          class="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground aria-selected:bg-accent aria-selected:font-medium aria-selected:text-foreground"
          @click="changeTab(tab.id)"
        >
          <component :is="tab.icon" class="size-4" />
          {{ tab.label }}
        </button>
      </nav>
    </aside>

    <main class="min-h-0 overflow-hidden p-8 pr-10">
      <section
        v-show="activeTab === 'search'"
        id="setting-panel-search"
        role="tabpanel"
        aria-labelledby="setting-tab-search"
        class="h-full min-h-0"
      >
        <SearchSettings v-if="hasVisitedSearch" />
      </section>

      <section
        v-if="activeTab === 'general'"
        id="setting-panel-general"
        role="tabpanel"
        aria-labelledby="setting-tab-general"
      >
        <h2 class="text-base font-semibold">常规</h2>
        <p class="mt-1 text-xs text-muted-foreground">调整 Willow 的外观。</p>

        <div class="mt-4">
          <Label class="mb-3 block">外观</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            :model-value="themeMode"
            class="grid w-full grid-cols-3 gap-3"
            :spacing="3"
            @update:model-value="updateTheme"
          >
            <ToggleGroupItem
              v-for="option in themeOptions"
              :key="option.id"
              :value="option.id"
              class="h-24 flex-col items-start justify-between rounded-xl border bg-background p-3 text-left data-[state=on]:border-primary data-[state=on]:bg-primary/5"
            >
              <component :is="option.icon" class="size-5" />
              <span>
                <span class="block text-sm font-medium">{{ option.label }}</span>
                <span class="mt-1 block text-xs font-normal text-muted-foreground">
                  {{ option.description }}
                </span>
              </span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </section>

      <section
        v-else-if="activeTab === 'models'"
        id="setting-panel-models"
        role="tabpanel"
        aria-labelledby="setting-tab-models"
      >
        <h2 class="text-base font-semibold">模型</h2>
        <p class="mt-1 text-xs text-muted-foreground">选择 Willow 在不同任务中使用的模型。</p>

        <div
          v-if="loadingProviders || loadingUserConfig"
          class="mt-4 text-xs text-muted-foreground"
        >
          正在读取模型配置…
        </div>
        <div v-else class="mt-4 space-y-4">
          <div
            v-if="userConfigError"
            class="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive"
            role="alert"
          >
            <CircleAlert class="size-4" />
            <span class="flex-1">{{ userConfigError }}</span>
            <Button v-if="!savingUserConfig" variant="ghost" size="sm" @click="loadUserConfig">
              重试
            </Button>
          </div>

          <div class="divide-y rounded-xl border bg-muted/20">
            <section
              class="flex items-center justify-between gap-8 p-3"
              aria-labelledby="large-model-heading"
            >
              <div>
                <h3 id="large-model-heading" class="text-sm font-semibold">大模型</h3>
                <p class="mt-1 text-xs text-muted-foreground">用于日常对话和运行工作。</p>
              </div>
              <div class="w-[250px] min-w-0">
                <Select
                  :model-value="encodeModel(userConfig.largeModel)"
                  :disabled="savingUserConfig || configuredModelProviders.length === 0"
                  @update:model-value="updateModelConfig('largeModel', $event)"
                >
                  <SelectTrigger id="large-model-select" class="w-full">
                    <SelectValue placeholder="选择已配置提供商的模型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup v-for="provider in configuredModelProviders" :key="provider.id">
                      <SelectLabel>{{ provider.name }}</SelectLabel>
                      <SelectItem
                        v-for="model in provider.models"
                        :key="`${provider.id}:${model.id}`"
                        :value="encodeModel({ providerId: provider.id, modelId: model.id })!"
                      >
                        {{ model.name }}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section
              class="flex items-center justify-between gap-8 p-3"
              aria-labelledby="small-model-heading"
            >
              <div>
                <h3 id="small-model-heading" class="text-sm font-semibold">小模型</h3>
                <p class="mt-1 text-xs text-muted-foreground">用于构建记忆和生成标题等。</p>
              </div>
              <div class="w-[250px] min-w-0">
                <Select
                  :model-value="encodeModel(userConfig.smallModel)"
                  :disabled="savingUserConfig || configuredModelProviders.length === 0"
                  @update:model-value="updateModelConfig('smallModel', $event)"
                >
                  <SelectTrigger id="small-model-select" class="w-full">
                    <SelectValue placeholder="选择已配置提供商的模型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup v-for="provider in configuredModelProviders" :key="provider.id">
                      <SelectLabel>{{ provider.name }}</SelectLabel>
                      <SelectItem
                        v-for="model in provider.models"
                        :key="`${provider.id}:${model.id}`"
                        :value="encodeModel({ providerId: provider.id, modelId: model.id })!"
                      >
                        {{ model.name }}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </section>
          </div>

          <p v-if="configuredModelProviders.length === 0" class="text-xs text-muted-foreground">
            请先在“提供商”中连接至少一个提供商。
          </p>
        </div>
      </section>

      <section
        v-else-if="activeTab === 'providers'"
        id="setting-panel-providers"
        role="tabpanel"
        aria-labelledby="setting-tab-providers"
        class="flex h-full min-h-0 flex-col"
      >
        <h2 class="text-base font-semibold">提供商</h2>
        <p class="mt-1 text-xs text-muted-foreground">连接用于 Willow 的 AI 提供商。</p>

        <div v-if="loadingProviders" class="mt-4 text-xs text-muted-foreground">
          正在读取提供商…
        </div>
        <div v-else-if="providerLoadError" class="mt-4 rounded-xl border p-5">
          <div class="flex items-center gap-2 text-xs text-destructive">
            <CircleAlert class="size-4" />
            无法读取提供商信息，请重试。
          </div>
          <Button variant="secondary" class="mt-4" @click="loadProviders">重试</Button>
        </div>
        <div v-else class="mt-4 flex min-h-0 flex-1 flex-col gap-10">
          <section class="shrink-0" aria-labelledby="connected-providers-heading">
            <h3 id="connected-providers-heading" class="text-sm font-semibold">已连接的提供商</h3>
            <div
              v-if="connectedProviders.length"
              class="mt-4 divide-y rounded-xl border bg-muted/20"
            >
              <div
                v-for="provider in connectedProviders"
                :key="provider.id"
                class="flex items-center gap-2 px-3 py-3"
              >
                <ProviderMark :provider-id="provider.id" :name="provider.name" />
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2 text-sm">
                    <span class="font-medium">{{ provider.name }}</span>
                    <Badge variant="outline" class="text-muted-foreground">API 密钥</Badge>
                  </div>
                  <p
                    v-if="providerActionErrors[provider.id]"
                    class="mt-1 text-xs text-destructive"
                    role="alert"
                  >
                    {{ providerActionErrors[provider.id] }}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  :loading="disconnectingProviderIds.has(provider.id)"
                  :disabled="disconnectingProviderIds.has(provider.id)"
                  @click="disconnectProvider(provider.id)"
                >
                  断开连接
                </Button>
              </div>
            </div>
            <div
              v-else
              class="mt-4 flex min-h-20 items-center rounded-xl border bg-muted/20 px-5 py-4 text-xs text-muted-foreground"
            >
              没有已连接的提供商。
            </div>
          </section>

          <section
            class="flex min-h-0 flex-1 flex-col"
            aria-labelledby="available-providers-heading"
          >
            <h3 id="available-providers-heading" class="text-sm font-semibold">可用提供商</h3>
            <div class="relative mt-4">
              <Search
                class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                v-model="searchQuery"
                class="h-10 rounded-xl pr-10 pl-9"
                placeholder="搜索提供商"
                aria-label="搜索可用提供商"
              />
              <button
                v-if="searchQuery"
                type="button"
                class="absolute top-1/2 right-3 -translate-y-1/2 rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label="清除搜索"
                @click="searchQuery = ''"
              >
                <X class="size-4" />
              </button>
            </div>

            <div
              v-if="availableProviders.length"
              class="mt-4 min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain rounded-xl border bg-muted/20 text-sm"
            >
              <div
                v-for="provider in availableProviders"
                :key="provider.id"
                class="flex items-center gap-2 px-3 py-3"
              >
                <ProviderMark :provider-id="provider.id" :name="provider.name" />
                <div class="min-w-0 flex-1">
                  <div class="font-medium">{{ provider.name }}</div>
                  <p class="mt-1 truncate text-xs text-muted-foreground">
                    使用 {{ provider.apiKeyLabel }} 连接
                  </p>
                </div>
                <Button variant="ghost" @click="openProviderConnection(provider)">
                  <Plus />
                  连接
                </Button>
              </div>
            </div>
            <div
              v-else
              class="mt-4 rounded-xl border bg-muted/20 px-5 py-6 text-xs text-muted-foreground"
            >
              <template v-if="unfilteredAvailableProviders.length === 0">
                所有可用提供商都已连接。
              </template>
              <template v-else>没有匹配“{{ searchQuery.trim() }}”的提供商。</template>
            </div>
          </section>
        </div>
      </section>

      <section
        v-else-if="activeTab === 'statistics'"
        id="setting-panel-statistics"
        role="tabpanel"
        aria-labelledby="setting-tab-statistics"
        class="h-full min-h-0"
      >
        <Statistics />
      </section>

      <section
        v-else-if="activeTab === 'about'"
        id="setting-panel-about"
        role="tabpanel"
        aria-labelledby="setting-tab-about"
        class="flex min-h-[420px] items-center justify-center"
      >
        <div class="text-center">
          <img
            :src="appIconUrl"
            alt=""
            class="mx-auto size-16 rounded-2xl shadow-sm"
            aria-hidden="true"
          />
          <h2 class="mt-4 text-2xl font-semibold">{{ appInfo?.name ?? "Willow" }}</h2>
          <p class="mt-1 text-xs text-muted-foreground">
            {{ appInfo ? `版本 ${appInfo.version}` : "正在读取版本…" }}
          </p>
        </div>
      </section>
    </main>
  </div>
</template>
