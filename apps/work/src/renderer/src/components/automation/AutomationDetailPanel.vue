<script setup lang="ts">
import type {
  AutomationInfo,
  AutomationRunInfo,
  AutomationRunStatus,
  AutomationScheduleMode,
  AutomationStatus,
  ProviderInfo,
  WorkspaceInfo,
} from "@shared/api";
import { Badge } from "@willow/shadcn/components/ui/badge";
import { Button } from "@willow/shadcn/components/ui/button";
import { Input } from "@willow/shadcn/components/ui/input";
import { Label } from "@willow/shadcn/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@willow/shadcn/components/ui/select";
import { Skeleton } from "@willow/shadcn/components/ui/skeleton";
import { Switch } from "@willow/shadcn/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@willow/shadcn/components/ui/tabs";
import { Textarea } from "@willow/shadcn/components/ui/textarea";
import {
  CircleAlert,
  History,
  LoaderCircle,
  MessageSquareText,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  X,
} from "lucide-vue-next";
import { computed, reactive, ref, shallowRef, watch } from "vue";
import { useRouter } from "vue-router";
import ScheduleFields from "@/components/automation/ScheduleFields.vue";
import { useDialog } from "@/components/dialog";
import DeleteAutomationDialog from "@/components/dialog/automation/DeleteAutomationDialog.vue";
import { useAutomationDetail } from "@/composables/useAutomation";
import {
  AUTOMATION_RUN_KIND_LABELS,
  AUTOMATION_RUN_STATUS_LABELS,
  buildCronForMode,
  detectScheduleMode,
  formatDateTime,
  formatDuration,
  parseCronTime,
  parseCronWeekdays,
} from "@/lib/automation-schedule";
import { electronAPI } from "@/lib/ipc";

const props = defineProps<{
  automationId?: number;
}>();

const emit = defineEmits<{
  close: [];
  deleted: [];
}>();

const router = useRouter();
const { openDialog } = useDialog();

const automationId = computed(() => props.automationId);
const activeTab = ref("detail");

const {
  automation,
  loading,
  loadError,
  runs,
  hasMore,
  runsLoading,
  runsError,
  loadMore,
  onChanged,
  saveAutomation,
  runAutomationNow,
} = useAutomationDetail(() => automationId.value);

const workspaces = shallowRef<WorkspaceInfo[]>([]);
const providers = shallowRef<ProviderInfo[]>([]);
const configuredProviderIds = shallowRef<ReadonlySet<string>>(new Set());
const formReady = ref(false);
const saving = ref(false);
const saveError = ref("");
const runningNow = ref(false);
const backgroundUpdated = ref(false);
const lastSynced = shallowRef<AutomationInfo>();

const form = reactive({
  title: "",
  workspaceId: undefined as number | undefined,
  prompt: "",
  followDefaultModel: true,
  modelProviderId: "",
  modelModelId: "",
  status: "enabled" as AutomationStatus,
  scheduleMode: "daily_at" as AutomationScheduleMode,
  time: "09:00",
  weekdays: [1, 2, 3, 4, 5] as number[],
  customCron: "0 9 * * *",
});

const timezone = computed(() => automation.value?.trigger.timezone ?? "");
const cronExpression = computed(() =>
  buildCronForMode(form.scheduleMode, {
    time: form.time,
    weekdays: form.weekdays,
    custom: form.customCron,
  }),
);
const selectableProviders = computed(() =>
  providers.value.filter(
    (provider) => configuredProviderIds.value.has(provider.id) && provider.models.length > 0,
  ),
);
const availableModels = computed(() => {
  const provider = selectableProviders.value.find((item) => item.id === form.modelProviderId);
  return provider?.models ?? [];
});
const isDirty = computed(() => {
  const current = lastSynced.value ?? automation.value;
  if (!current) return false;
  const mode = detectScheduleMode(current.trigger.cronExpression);
  return (
    form.title !== current.title ||
    form.workspaceId !== current.workspaceId ||
    form.prompt !== current.prompt ||
    form.status !== current.status ||
    form.followDefaultModel !== (current.model === undefined) ||
    (current.model !== undefined &&
      (form.modelProviderId !== current.model.providerId ||
        form.modelModelId !== current.model.modelId)) ||
    form.scheduleMode !== mode ||
    (mode === "daily_at" || mode === "weekly_at"
      ? form.time !== (parseCronTime(current.trigger.cronExpression) ?? "")
      : false) ||
    (mode === "weekly_at"
      ? !sameWeekdays(form.weekdays, parseCronWeekdays(current.trigger.cronExpression))
      : false) ||
    (mode === "custom" ? form.customCron !== current.trigger.cronExpression : false)
  );
});
const canSave = computed(
  () =>
    formReady.value &&
    !saving.value &&
    automation.value !== undefined &&
    isDirty.value &&
    form.workspaceId !== undefined &&
    form.prompt.trim() !== "" &&
    cronExpression.value.trim() !== "" &&
    (form.followDefaultModel || (form.modelProviderId !== "" && form.modelModelId !== "")),
);
const canRunNow = computed(
  () =>
    automation.value?.status === "enabled" && !isDirty.value && !runningNow.value && !saving.value,
);

function sameWeekdays(left: number[], right: number[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((day) => rightSet.has(day));
}

function fillForm(current: AutomationInfo) {
  const mode = detectScheduleMode(current.trigger.cronExpression);
  const timeValue = parseCronTime(current.trigger.cronExpression) ?? "09:00";
  const weekdays = parseCronWeekdays(current.trigger.cronExpression);
  form.title = current.title;
  form.workspaceId = current.workspaceId;
  form.prompt = current.prompt;
  form.status = current.status;
  form.followDefaultModel = current.model === undefined;
  form.modelProviderId = current.model?.providerId ?? "";
  form.modelModelId = current.model?.modelId ?? "";
  if (current.model && !isModelSelectable(form.modelProviderId, form.modelModelId)) {
    // 已保存的模型提供商不再可用（未配置），需要重新选择已配置提供商的模型。
    form.modelProviderId = "";
    form.modelModelId = "";
  }
  form.scheduleMode = mode;
  form.time = timeValue;
  form.weekdays = weekdays.length > 0 ? weekdays : [1, 2, 3, 4, 5];
  form.customCron = current.trigger.cronExpression;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function handleProviderChange(providerId: string) {
  form.modelProviderId = providerId;
  const provider = selectableProviders.value.find((item) => item.id === providerId);
  form.modelModelId = provider?.models[0]?.id ?? "";
}

function isModelSelectable(providerId: string, modelId: string): boolean {
  return selectableProviders.value.some(
    (provider) =>
      provider.id === providerId && provider.models.some((model) => model.id === modelId),
  );
}

function resetForm() {
  if (automation.value) {
    fillForm(automation.value);
    lastSynced.value = automation.value;
  }
  backgroundUpdated.value = false;
  saveError.value = "";
}

async function save() {
  const current = automation.value;
  if (!current || !canSave.value) return;

  saving.value = true;
  saveError.value = "";
  try {
    await saveAutomation({
      id: current.id,
      workspaceId: form.workspaceId,
      title: form.title,
      prompt: form.prompt,
      status: form.status,
      model: form.followDefaultModel
        ? null
        : { providerId: form.modelProviderId, modelId: form.modelModelId },
      trigger: {
        type: "schedule",
        cronExpression: cronExpression.value,
      },
    });
    if (automation.value) {
      fillForm(automation.value);
      lastSynced.value = automation.value;
    }
    backgroundUpdated.value = false;
  } catch (error) {
    saveError.value = getErrorMessage(error, "保存失败，请重试。");
  } finally {
    saving.value = false;
  }
}

async function runNow() {
  if (!canRunNow.value) return;

  runningNow.value = true;
  try {
    const run = await runAutomationNow();
    if (run.sessionId) {
      await router.push({
        name: "chat",
        params: { sessionId: run.sessionId },
        query: { workspaceId: String(run.workspaceId) },
      });
      return;
    }
    if (run.status === "failed" && run.errorMessage) {
      saveError.value = run.errorMessage;
    }
  } catch (error) {
    saveError.value = getErrorMessage(error, "立即执行失败，请重试。");
  } finally {
    runningNow.value = false;
  }
}

function confirmDelete() {
  const current = automation.value;
  if (!current) return;
  openDialog(
    DeleteAutomationDialog,
    {
      automationId: current.id,
      title: current.title,
      onDeleted: () => emit("deleted"),
    },
    { contentClass: "sm:max-w-md" },
  );
}

function openSession(run: AutomationRunInfo) {
  if (!run.sessionId) return;
  void router.push({
    name: "chat",
    params: { sessionId: run.sessionId },
    query: { workspaceId: String(run.workspaceId) },
  });
}

function runStatusClass(status: AutomationRunStatus): string {
  switch (status) {
    case "failed":
    case "interrupted":
      return "bg-destructive/10 text-destructive";
    case "running":
      return "bg-primary/10 text-primary";
    case "skipped":
      return "bg-muted text-muted-foreground";
    case "completed":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
}

watch(automation, (current) => {
  if (!current) return;
  if (!formReady.value || !isDirty.value) {
    fillForm(current);
    lastSynced.value = current;
  }
  formReady.value = true;
});

onChanged((payload) => {
  if (payload.type === "updated" && isDirty.value) {
    backgroundUpdated.value = true;
  }
});

(async () => {
  try {
    const [workspaceResponse, catalogResponse, configuredResponse] = await Promise.all([
      electronAPI.getWorkspaceList({ pinned: false }),
      electronAPI.getProviderCatalog(),
      electronAPI.getConfiguredProviders(),
    ]);
    workspaces.value = workspaceResponse.workspaces;
    providers.value = catalogResponse.providers;
    configuredProviderIds.value = new Set(configuredResponse.providerIds);
    if (automation.value) {
      fillForm(automation.value);
      lastSynced.value = automation.value;
      formReady.value = true;
    }
  } catch {
    // The edit form stays usable with defaults; save will surface errors.
  }
})();
</script>

<template>
  <aside
    class="flex h-full w-[calc(100%_-_500px)] shrink-0 flex-col overflow-hidden border-l bg-background"
    data-slot="automation-detail-panel"
  >
    <header class="flex shrink-0 items-center gap-2 border-b px-4 py-3">
      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-2">
          <h2 class="truncate text-sm font-semibold text-foreground">
            {{ automation?.title ?? "自动化详情" }}
          </h2>
          <Badge
            v-if="automation"
            variant="outline"
            class="shrink-0 px-1.5 py-0.5 text-[11px] font-normal"
            :class="
              form.status === 'enabled'
                ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : ''
            "
            data-slot="automation-status-badge"
          >
            {{ form.status === "enabled" ? "已启用" : "已停用" }}
          </Badge>
        </div>
        <p v-if="automation" class="mt-0.5 truncate text-xs text-muted-foreground">
          {{ automation.trigger.cronExpression }} · {{ automation.trigger.timezone }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <Switch
          :model-value="form.status === 'enabled'"
          :disabled="saving || !automation"
          :aria-label="
            automation
              ? form.status === 'enabled'
                ? '暂停自动化'
                : '开启自动化'
              : '开启或暂停自动化'
          "
          :title="
            automation
              ? form.status === 'enabled'
                ? '暂停自动化'
                : '开启自动化'
              : '开启或暂停自动化'
          "
          @update:model-value="(value: boolean) => (form.status = value ? 'enabled' : 'disabled')"
        />
        <div class="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
        <Button
          variant="ghost"
          size="icon"
          class="size-8 shrink-0"
          :disabled="saving || !automation || !isDirty"
          aria-label="重置表单"
          title="重置"
          data-slot="automation-reset"
          @click="resetForm"
        >
          <RotateCcw class="size-4" aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          class="size-8 shrink-0"
          :disabled="!canSave"
          :aria-busy="saving || undefined"
          aria-label="保存修改"
          title="保存"
          data-slot="automation-save"
          @click="save"
        >
          <LoaderCircle v-if="saving" class="animate-spin" aria-hidden="true" />
          <Save v-else aria-hidden="true" />
        </Button>
        <Button
          id="run-now-button"
          variant="ghost"
          size="icon"
          class="size-8 shrink-0"
          :disabled="!canRunNow"
          :aria-label="automation ? '立即执行' : '立即执行自动化'"
          :title="
            !automation
              ? '立即执行自动化'
              : form.status !== 'enabled'
                ? '已停用的自动化无法立即执行'
                : isDirty
                  ? '存在未保存的修改'
                  : '立即执行'
          "
          :aria-busy="runningNow || undefined"
          @click="runNow"
        >
          <LoaderCircle v-if="runningNow" class="animate-spin" aria-hidden="true" />
          <Play v-else aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="size-8 shrink-0 text-destructive hover:text-destructive"
          :disabled="saving || !automation"
          aria-label="删除自动化"
          title="删除自动化"
          data-slot="automation-delete"
          @click="confirmDelete"
        >
          <Trash2 class="size-4" aria-hidden="true" />
        </Button>
        <div class="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
        <Button
          variant="ghost"
          size="icon"
          class="size-8 shrink-0 text-muted-foreground"
          aria-label="关闭自动化详情"
          title="关闭"
          data-slot="automation-detail-close"
          @click="emit('close')"
        >
          <X class="size-4" aria-hidden="true" />
        </Button>
      </div>
    </header>

    <Tabs v-model="activeTab" class="flex min-h-0 min-w-0 flex-1 gap-0" default-value="detail">
      <TabsList
        class="mx-4 mt-3 grid shrink-0 grid-cols-2"
        aria-label="自动化详情标签页"
        data-slot="automation-detail-tabs"
      >
        <TabsTrigger value="detail" data-slot="automation-detail-tab">
          <Settings2 class="size-4" aria-hidden="true" />
          详情
        </TabsTrigger>
        <TabsTrigger value="history" data-slot="automation-history-tab">
          <History class="size-4" aria-hidden="true" />
          历史
        </TabsTrigger>
      </TabsList>

      <TabsContent value="detail" class="h-full min-h-0 overflow-y-auto">
        <div v-if="backgroundUpdated" class="mb-4" data-slot="automation-background-updated">
          <div
            class="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
            role="status"
          >
            <RefreshCw class="size-3.5 shrink-0" aria-hidden="true" />
            自动化已在后台更新，当前表单包含未保存的修改。
          </div>
        </div>

        <div v-if="loading" class="grid gap-4" data-slot="automation-detail-loading">
          <Skeleton class="h-56 rounded-2xl" />
          <Skeleton class="h-36 rounded-2xl" />
        </div>

        <section
          v-else-if="loadError || !automation"
          class="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center"
          data-slot="automation-detail-error"
          role="alert"
        >
          <CircleAlert class="size-10 text-muted-foreground" aria-hidden="true" />
          <p class="mt-4 text-sm font-medium text-foreground">
            {{ loadError || "自动化不存在或已被删除" }}
          </p>
          <Button variant="secondary" class="mt-5" @click="emit('close')">关闭</Button>
        </section>

        <template v-else>
          <div class="grid gap-4 bg-card p-4" data-slot="automation-settings">
            <div class="grid gap-2">
              <Label for="detail-title">名称（可选）</Label>
              <Input
                id="detail-title"
                v-model="form.title"
                placeholder="例如：每日代码审查"
                :disabled="saving"
              />
            </div>

            <div class="grid gap-2">
              <Label for="detail-workspace">工作空间</Label>
              <Select
                :model-value="form.workspaceId !== undefined ? String(form.workspaceId) : undefined"
                :disabled="saving"
                @update:model-value="
                  (value: unknown) => {
                    const id = Number(value);
                    if (Number.isInteger(id)) form.workspaceId = id;
                  }
                "
              >
                <SelectTrigger id="detail-workspace" class="w-full">
                  <SelectValue placeholder="选择工作空间" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="workspace in workspaces"
                    :key="workspace.id"
                    :value="String(workspace.id)"
                  >
                    {{ workspace.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="grid gap-2">
              <Label for="detail-prompt">提示词</Label>
              <Textarea id="detail-prompt" v-model="form.prompt" :rows="5" :disabled="saving" />
            </div>

            <div class="grid gap-2">
              <div class="flex items-center justify-between gap-4">
                <Label>模型</Label>
                <div class="flex items-center gap-2 text-sm">
                  <span class="text-muted-foreground">跟随默认模型</span>
                  <Switch
                    :model-value="form.followDefaultModel"
                    :disabled="saving"
                    aria-label="跟随默认模型"
                    @update:model-value="(value: boolean) => (form.followDefaultModel = value)"
                  />
                </div>
              </div>
              <div v-if="!form.followDefaultModel" class="grid grid-cols-2 gap-3">
                <div class="grid gap-2">
                  <Label for="detail-model-provider">提供商</Label>
                  <Select
                    :model-value="form.modelProviderId || undefined"
                    :disabled="saving"
                    @update:model-value="
                      (value: unknown) => {
                        if (typeof value === 'string') handleProviderChange(value);
                      }
                    "
                  >
                    <SelectTrigger id="detail-model-provider">
                      <SelectValue placeholder="选择提供商" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="provider in selectableProviders"
                        :key="provider.id"
                        :value="provider.id"
                      >
                        {{ provider.name }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="grid gap-2">
                  <Label for="detail-model">模型</Label>
                  <Select
                    :model-value="form.modelModelId || undefined"
                    :disabled="saving || availableModels.length === 0"
                    @update:model-value="
                      (value: unknown) => {
                        if (typeof value === 'string') form.modelModelId = value;
                      }
                    "
                  >
                    <SelectTrigger id="detail-model">
                      <SelectValue placeholder="选择模型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="model in availableModels"
                        :key="model.id"
                        :value="model.id"
                      >
                        {{ model.name }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <ScheduleFields
              v-model:schedule-mode="form.scheduleMode"
              v-model:time="form.time"
              v-model:weekdays="form.weekdays"
              v-model:custom-cron="form.customCron"
              :timezone="timezone"
              :disabled="saving"
            />

            <div
              v-if="saveError"
              class="flex items-center gap-2 text-sm text-destructive"
              role="alert"
            >
              <CircleAlert class="size-4 shrink-0" aria-hidden="true" />
              <span>{{ saveError }}</span>
            </div>
          </div>
        </template>
      </TabsContent>

      <TabsContent value="history" class="h-full min-h-0 overflow-y-auto px-4 pt-4 pb-8">
        <div class="flex items-center justify-between gap-4">
          <h2 class="flex items-center gap-2 text-sm font-semibold text-foreground">
            <History class="size-4 text-muted-foreground" aria-hidden="true" />
            执行历史
          </h2>
          <span class="text-xs text-muted-foreground">{{ runs.length }} 条记录</span>
        </div>

        <div
          v-if="runs.length === 0 && !runsLoading"
          class="mt-4"
          data-slot="automation-runs-empty"
        >
          <div
            class="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed text-center"
          >
            <History class="size-8 text-muted-foreground" aria-hidden="true" />
            <p class="mt-3 text-sm text-muted-foreground">暂无执行记录，自动化运行后会显示在这里</p>
          </div>
        </div>

        <div v-else class="mt-4 grid gap-2" data-slot="automation-runs">
          <article
            v-for="run in runs"
            :key="run.id"
            class="rounded-xl border bg-card p-3.5"
            :data-slot="`automation-run-${run.id}`"
          >
            <div class="flex min-w-0 items-center gap-3">
              <Badge variant="outline" class="shrink-0 font-normal text-muted-foreground">
                {{ AUTOMATION_RUN_KIND_LABELS[run.runKind] }}
              </Badge>
              <Badge
                class="shrink-0 px-1.5 py-0.5 text-[11px] font-normal"
                :class="runStatusClass(run.status)"
              >
                {{ AUTOMATION_RUN_STATUS_LABELS[run.status] }}
              </Badge>
              <div class="min-w-0 flex-1 text-xs text-muted-foreground">
                <span v-if="run.scheduledFor">
                  计划 {{ formatDateTime(run.scheduledFor, automation?.trigger.timezone) }}
                  <span class="text-muted-foreground/60">·</span>
                </span>
                开始 {{ formatDateTime(run.triggeredAt) }}
                <span v-if="run.finishedAt">
                  <span class="text-muted-foreground/60">·</span>
                  完成 {{ formatDateTime(run.finishedAt) }}
                  <span class="text-muted-foreground/60">·</span>
                  耗时 {{ formatDuration(run.triggeredAt, run.finishedAt) }}
                </span>
              </div>
              <Button
                v-if="run.sessionId"
                variant="ghost"
                size="sm"
                class="shrink-0 text-muted-foreground"
                data-slot="automation-run-open-session"
                @click="openSession(run)"
              >
                <MessageSquareText class="size-4" aria-hidden="true" />
                查看会话
              </Button>
            </div>
            <p
              v-if="run.errorMessage"
              class="mt-2 rounded-lg bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive"
              role="alert"
            >
              {{ run.errorMessage }}
            </p>
          </article>
        </div>

        <div
          v-if="runsError"
          class="mt-3 flex items-center gap-2 text-sm text-destructive"
          role="alert"
        >
          <CircleAlert class="size-4 shrink-0" aria-hidden="true" />
          <span>{{ runsError }}</span>
        </div>

        <div v-if="hasMore" class="mt-4 text-center">
          <Button
            variant="outline"
            data-slot="automation-load-more"
            :disabled="runsLoading"
            :aria-busy="runsLoading || undefined"
            @click="loadMore"
          >
            <LoaderCircle v-if="runsLoading" class="animate-spin" aria-hidden="true" />
            加载更多
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  </aside>
</template>
