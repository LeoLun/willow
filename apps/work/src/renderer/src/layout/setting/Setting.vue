<script setup lang="ts">
import type { GetAppInfoResponse, ProviderInfo } from "@shared/api";
import { DialogDescription, DialogTitle } from "@willow/shadcn/components/ui/dialog";
import { Input } from "@willow/shadcn/components/ui/input";
import { Label } from "@willow/shadcn/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@willow/shadcn/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@willow/shadcn/components/ui/toggle-group";
import {
  CheckCircle2,
  CircleAlert,
  Cpu,
  Info,
  KeyRound,
  Laptop,
  Moon,
  Settings2,
  Sun,
  Trash2,
} from "lucide-vue-next";
import { computed, onMounted, ref, shallowRef } from "vue";
import { Button } from "@/components/ui/button";
import { useDarkMode } from "@/composables/useDarkMode";
import { electronAPI } from "@/lib/ipc";
import {
  readModelPreference,
  resolveModelPreference,
  writeModelPreference,
} from "@/lib/model-preference";

type SettingTab = "general" | "providers" | "about";

const tabs = [
  { id: "general" as const, label: "常规", icon: Settings2 },
  { id: "providers" as const, label: "提供商", icon: Cpu },
  { id: "about" as const, label: "关于", icon: Info },
];

const themeOptions = [
  { id: "system" as const, label: "自动", description: "跟随系统外观", icon: Laptop },
  { id: "light" as const, label: "浅色", description: "始终使用浅色", icon: Sun },
  { id: "dark" as const, label: "深色", description: "始终使用深色", icon: Moon },
];

const activeTab = ref<SettingTab>("general");
const providers = shallowRef<ProviderInfo[]>([]);
const selectedProviderId = ref("");
const selectedModelId = ref("");
const appInfo = ref<GetAppInfoResponse>();
const loadingCatalog = ref(true);
const catalogError = ref(false);
const loadingCredential = ref(false);
const credentialBusy = ref(false);
const configured = ref(false);
const apiKey = ref("");
const statusMessage = ref("");
const statusKind = ref<"success" | "error" | "info">("info");
const deleteConfirm = ref(false);

const { themeMode } = useDarkMode();

const selectedProvider = computed(() =>
  providers.value.find((provider) => provider.id === selectedProviderId.value),
);

const selectedModels = computed(() => selectedProvider.value?.models ?? []);

function updateTheme(value: unknown) {
  if (value === "system" || value === "light" || value === "dark") {
    themeMode.value = value;
  }
}

function showStatus(message: string, kind: "success" | "error" | "info" = "info") {
  statusMessage.value = message;
  statusKind.value = kind;
}

function persistSelection() {
  if (!selectedProviderId.value) {
    writeModelPreference(localStorage, undefined);
    return;
  }
  writeModelPreference(localStorage, {
    providerId: selectedProviderId.value,
    modelId: selectedModelId.value,
  });
}

async function loadCredentialStatus() {
  if (!selectedProviderId.value) return;
  loadingCredential.value = true;
  try {
    const response = await electronAPI.getCredential({ providerId: selectedProviderId.value });
    configured.value = response.configured;
  } catch {
    configured.value = false;
    showStatus("无法读取提供商配置状态", "error");
  } finally {
    loadingCredential.value = false;
  }
}

async function saveCredential() {
  if (!selectedProviderId.value || !apiKey.value.trim()) return;
  credentialBusy.value = true;
  try {
    await electronAPI.setCredential({
      providerId: selectedProviderId.value,
      apiKey: apiKey.value,
    });
    apiKey.value = "";
    configured.value = true;
    showStatus("提供商配置已保存", "success");
  } catch {
    showStatus("保存失败，请检查系统凭证加密是否可用", "error");
  } finally {
    credentialBusy.value = false;
  }
}

async function handleDelete() {
  if (!deleteConfirm.value) {
    deleteConfirm.value = true;
    showStatus("再次点击删除以确认操作", "info");
    return;
  }
  credentialBusy.value = true;
  try {
    await electronAPI.deleteCredential({ providerId: selectedProviderId.value });
    configured.value = false;
    apiKey.value = "";
    deleteConfirm.value = false;
    showStatus("提供商配置已删除", "success");
  } catch {
    showStatus("删除配置失败，请重试", "error");
  } finally {
    credentialBusy.value = false;
  }
}

function changeTab(tab: SettingTab) {
  activeTab.value = tab;
  deleteConfirm.value = false;
  statusMessage.value = "";
}

async function changeProvider(value: unknown) {
  if (typeof value !== "string") return;
  selectedProviderId.value = value;
  selectedModelId.value = selectedProvider.value?.models[0]?.id ?? "";
  deleteConfirm.value = false;
  apiKey.value = "";
  statusMessage.value = "";
  persistSelection();
  await loadCredentialStatus();
}

function changeModel(value: unknown) {
  if (typeof value !== "string") return;
  selectedModelId.value = value;
  persistSelection();
}

onMounted(async () => {
  const [catalogResult, appInfoResult] = await Promise.allSettled([
    electronAPI.getProviderCatalog(),
    electronAPI.getAppInfo(),
  ]);

  if (catalogResult.status === "fulfilled") {
    providers.value = catalogResult.value.providers;
    const preference = resolveModelPreference(providers.value, readModelPreference(localStorage));
    selectedProviderId.value = preference?.providerId ?? "";
    selectedModelId.value = preference?.modelId ?? "";
    persistSelection();
    await loadCredentialStatus();
  } else {
    catalogError.value = true;
    showStatus("无法读取提供商目录", "error");
  }
  if (appInfoResult.status === "fulfilled") appInfo.value = appInfoResult.value;
  loadingCatalog.value = false;
});
</script>

<template>
  <div class="grid h-full min-h-0 grid-cols-[180px_minmax(0,1fr)] bg-background">
    <DialogTitle class="sr-only">设置</DialogTitle>
    <DialogDescription class="sr-only"> 配置应用外观、AI 提供商和应用信息。 </DialogDescription>

    <aside class="border-r bg-muted/35 p-3 pt-5">
      <div class="px-3 pb-4 text-lg font-semibold">设置</div>
      <nav class="space-y-1" role="tablist" aria-label="设置分类" aria-orientation="vertical">
        <button
          v-for="tab in tabs"
          :id="`setting-tab-${tab.id}`"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.id"
          :aria-controls="`setting-panel-${tab.id}`"
          class="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground aria-selected:bg-accent aria-selected:font-medium aria-selected:text-foreground"
          @click="changeTab(tab.id)"
        >
          <component :is="tab.icon" class="size-4" />
          {{ tab.label }}
        </button>
      </nav>
    </aside>

    <main class="min-h-0 overflow-y-auto p-8 pr-10">
      <section
        v-if="activeTab === 'general'"
        id="setting-panel-general"
        role="tabpanel"
        aria-labelledby="setting-tab-general"
      >
        <h2 class="text-xl font-semibold">常规</h2>
        <p class="mt-1 text-sm text-muted-foreground">调整 Willow 的外观。</p>

        <div class="mt-8">
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
              class="h-24 flex-col items-start justify-between rounded-xl border bg-background p-4 text-left data-[state=on]:border-primary data-[state=on]:bg-primary/5"
            >
              <component :is="option.icon" class="size-5" />
              <span>
                <span class="block font-medium">{{ option.label }}</span>
                <span class="mt-1 block text-xs font-normal text-muted-foreground">
                  {{ option.description }}
                </span>
              </span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </section>

      <section
        v-else-if="activeTab === 'providers'"
        id="setting-panel-providers"
        role="tabpanel"
        aria-labelledby="setting-tab-providers"
      >
        <h2 class="text-xl font-semibold">提供商</h2>
        <p class="mt-1 text-sm text-muted-foreground">选择默认模型并配置 API 凭证。</p>

        <div v-if="loadingCatalog" class="mt-8 text-sm text-muted-foreground">正在读取目录…</div>
        <div v-else-if="catalogError" class="mt-8 rounded-lg border p-4 text-sm text-destructive">
          无法读取提供商目录，请重启应用后重试。
        </div>
        <div v-else-if="providers.length === 0" class="mt-8 rounded-lg border p-4 text-sm">
          暂无可配置的提供商。
        </div>
        <div v-else class="mt-7 space-y-6">
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="provider-select">提供商</Label>
              <Select :model-value="selectedProviderId" @update:model-value="changeProvider">
                <SelectTrigger id="provider-select" class="w-full">
                  <SelectValue placeholder="选择提供商" />
                </SelectTrigger>
                <SelectContent class="max-h-[15rem]">
                  <SelectItem v-for="provider in providers" :key="provider.id" :value="provider.id">
                    {{ provider.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label for="model-select">默认模型</Label>
              <Select
                :model-value="selectedModelId"
                :disabled="selectedModels.length === 0"
                @update:model-value="changeModel"
              >
                <SelectTrigger id="model-select" class="w-full">
                  <SelectValue
                    :placeholder="selectedModels.length === 0 ? '暂无模型' : '选择默认模型'"
                  />
                </SelectTrigger>
                <SelectContent class="max-h-[15rem]">
                  <SelectItem v-for="model in selectedModels" :key="model.id" :value="model.id">
                    {{ model.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="rounded-xl border bg-muted/20 p-5">
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="flex items-center gap-2 font-medium">
                  <KeyRound class="size-4" />
                  API Key
                </div>
                <p class="mt-1 text-sm text-muted-foreground">
                  <template v-if="loadingCredential">正在读取配置状态…</template>
                  <template v-else-if="configured">已配置 API Key</template>
                  <template v-else>尚未配置</template>
                </p>
              </div>
            </div>

            <form class="mt-5 border-t pt-5" @submit.prevent="saveCredential">
              <Label for="provider-api-key">API Key</Label>
              <Input
                id="provider-api-key"
                v-model="apiKey"
                type="password"
                :placeholder="configured ? '输入新的 API Key 以覆盖当前配置' : '输入 API Key'"
                class="mt-2"
                autocomplete="off"
              />
              <div class="mt-4 flex justify-end gap-2">
                <Button
                  v-if="configured"
                  :variant="deleteConfirm ? 'destructive' : 'ghost'"
                  :loading="credentialBusy"
                  @click="handleDelete"
                >
                  <Trash2 />
                  {{ deleteConfirm ? "确认删除" : "删除" }}
                </Button>
                <Button
                  type="submit"
                  variant="accent"
                  :loading="credentialBusy"
                  :disabled="!apiKey.trim()"
                >
                  保存 API Key
                </Button>
              </div>
            </form>
          </div>

          <div
            v-if="statusMessage"
            class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            :class="{
              'bg-green-500/10 text-green-700 dark:text-green-400': statusKind === 'success',
              'bg-destructive/10 text-destructive': statusKind === 'error',
              'bg-muted text-muted-foreground': statusKind === 'info',
            }"
            role="status"
          >
            <CheckCircle2 v-if="statusKind === 'success'" class="size-4" />
            <CircleAlert v-else class="size-4" />
            {{ statusMessage }}
          </div>
        </div>
      </section>

      <section
        v-else
        id="setting-panel-about"
        role="tabpanel"
        aria-labelledby="setting-tab-about"
        class="flex min-h-[420px] items-center justify-center"
      >
        <div class="text-center">
          <div
            class="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary text-2xl font-semibold text-primary-foreground shadow-sm"
          >
            W
          </div>
          <h2 class="mt-4 text-2xl font-semibold">{{ appInfo?.name ?? "Willow" }}</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ appInfo ? `版本 ${appInfo.version}` : "正在读取版本…" }}
          </p>
        </div>
      </section>
    </main>
  </div>
</template>
