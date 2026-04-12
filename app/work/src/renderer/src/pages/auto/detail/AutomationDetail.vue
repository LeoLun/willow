<script setup lang="ts">
import type {
  Automation,
  AutomationScheduleMode,
  AutomationStatus,
  ModelConfig,
} from "@shared/api";
import { Badge } from "@willow/shadcn/components/ui/badge";
import { Button } from "@willow/shadcn/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@willow/shadcn/components/ui/dropdown-menu";
import { Input } from "@willow/shadcn/components/ui/input";
import { Skeleton } from "@willow/shadcn/components/ui/skeleton";
import { Textarea } from "@willow/shadcn/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@willow/shadcn/components/ui/toggle-group";
import { ArrowLeft, Check, ChevronsUpDown, RotateCcw, Trash2 } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { computed, ref, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import {
  formatAutomationSchedule,
  getAutomationLastRunLabel,
  getAutomationNextRunLabel,
  getAutomationPreviousRunText,
  getAutomationRunKindLabel,
} from "@/components/automation/display";
import {
  automationWeekdayOptions,
  useAutomationScheduleForm,
} from "@/components/automation/schedule-form";
import TimePicker from "@/components/automation/TimePicker.vue";
import MainTitle from "@/components/base/MainTitle.vue";
import { useDialog } from "@/layout/dialog";
import { DeleteAutomation } from "@/layout/dialog/delete-automation";
import { useAutomationStore } from "@/stores/automation";
import { useConfigStore } from "@/stores/config";
import { useWorkspaceStore } from "@/stores/workspace";

const statusOptions: Array<{ value: AutomationStatus; label: string }> = [
  { value: "enabled", label: "启用" },
  { value: "disabled", label: "停用" },
];

const route = useRoute();
const router = useRouter();
const automationStore = useAutomationStore();
const workspaceStore = useWorkspaceStore();
const configStore = useConfigStore();
const { openDialog } = useDialog();
const { detailLoading } = storeToRefs(automationStore);
const { workspaceList } = storeToRefs(workspaceStore);
const { modelList, defaultModel } = storeToRefs(configStore);

const {
  scheduleMode,
  dailyTime,
  weeklyTime,
  weeklyDays,
  customCronExpression,
  schedule,
  weeklyDaysError,
  customCronError,
  applyAutomationSchedule,
  getWeekdayButtonClass,
  toggleWeeklyDay,
} = useAutomationScheduleForm();

const notFound = ref(false);
const isSaving = ref(false);
const saveState = ref<"idle" | "success" | "error">("idle");
const title = ref("");
const prompt = ref("");
const status = ref<AutomationStatus>("enabled");
const workspaceId = ref<number | null>(null);
const modelId = ref<string | null>(null);

const automationId = computed(() => {
  const value = Number(route.params.automationId);
  return Number.isFinite(value) ? value : NaN;
});

const automation = computed<Automation | undefined>(() => {
  if (!Number.isFinite(automationId.value)) {
    return undefined;
  }

  return automationStore.getAutomationById(automationId.value);
});

const selectedWorkspace = computed(
  () => workspaceList.value.find((workspace) => workspace.id === workspaceId.value) ?? null,
);

const selectedModel = computed<ModelConfig | undefined>(() => {
  if (modelId.value) {
    return modelList.value.find((model) => model.modelId === modelId.value);
  }

  return defaultModel.value;
});

const missingSavedModel = computed(() => {
  if (!modelId.value) {
    return false;
  }

  return !modelList.value.find((model) => model.modelId === modelId.value);
});

const selectedStatusLabel = computed(
  () => statusOptions.find((item) => item.value === status.value)?.label ?? "未设置",
);

const selectedWorkspaceLabel = computed(() => {
  return selectedWorkspace.value?.name ?? "请选择工作空间";
});

const selectedModelLabel = computed(() => {
  if (missingSavedModel.value) {
    return `模型不可用 (${modelId.value})`;
  }

  if (modelId.value && selectedModel.value) {
    return selectedModel.value.name;
  }

  if (defaultModel.value) {
    return `默认模型 · ${defaultModel.value.name}`;
  }

  return "使用默认模型";
});

const reasoningSummary = computed(() => {
  if (selectedModel.value) {
    return selectedModel.value.reasoning ? "支持推理" : "不支持推理";
  }

  return "未配置";
});

const modelHint = computed(() => {
  if (missingSavedModel.value && defaultModel.value) {
    return `已保存模型不可用，当前会回退到默认模型 ${defaultModel.value.name}。`;
  }

  if (missingSavedModel.value) {
    return "已保存模型不可用，且当前没有默认模型。";
  }

  if (!modelId.value && defaultModel.value) {
    return `当前会使用默认模型 ${defaultModel.value.name} 执行。`;
  }

  if (!selectedModel.value) {
    return "当前没有可用模型。";
  }

  return `当前执行模型：${selectedModel.value.name}`;
});

const normalizedTitle = computed(() => title.value.trim());
const normalizedPrompt = computed(() => prompt.value.trim());

const isValid = computed(() => {
  return (
    !!automation.value &&
    !!workspaceId.value &&
    !!normalizedPrompt.value &&
    !weeklyDaysError.value &&
    !customCronError.value
  );
});

const isDirty = computed(() => {
  if (!automation.value) {
    return false;
  }

  return (
    normalizedTitle.value !== automation.value.title ||
    normalizedPrompt.value !== automation.value.prompt ||
    status.value !== automation.value.status ||
    workspaceId.value !== automation.value.workspaceId ||
    (modelId.value ?? null) !== (automation.value.modelId ?? null) ||
    schedule.value.cronExpression !== (automation.value.trigger?.cronExpression ?? "")
  );
});

const repeatLabel = computed(() => {
  const cronExpression = schedule.value.cronExpression.trim();
  if (!cronExpression) {
    return "未设置";
  }
  return formatAutomationSchedule(cronExpression);
});

const previousRunText = computed(() => {
  if (!automation.value) {
    return "从未运行";
  }

  return getAutomationPreviousRunText(automation.value);
});

function applyFormState(nextAutomation: Automation) {
  title.value = nextAutomation.title;
  prompt.value = nextAutomation.prompt;
  status.value = nextAutomation.status;
  workspaceId.value = nextAutomation.workspaceId;
  modelId.value = nextAutomation.modelId ?? null;
  applyAutomationSchedule(nextAutomation);
  saveState.value = "idle";
}

async function loadAutomation() {
  if (!Number.isFinite(automationId.value)) {
    notFound.value = true;
    return;
  }

  notFound.value = false;
  try {
    await Promise.all([
      automationStore.fetchAutomation(automationId.value),
      workspaceList.value.length > 0 ? Promise.resolve() : workspaceStore.fetchWorkspaceList(),
      modelList.value.length > 0 ? Promise.resolve() : configStore.fetchModelList(),
    ]);
    const currentAutomation = automationStore.getAutomationById(automationId.value);
    notFound.value = !currentAutomation;
    if (currentAutomation) {
      applyFormState(currentAutomation);
    }
  } catch {
    notFound.value = true;
  }
}

function backToList() {
  router.push("/auto");
}

function resetForm() {
  if (!automation.value) {
    return;
  }

  applyFormState(automation.value);
}

async function handleSave() {
  if (!automation.value || !workspaceId.value || !isValid.value || isSaving.value) {
    return;
  }

  isSaving.value = true;
  saveState.value = "idle";
  try {
    const updatedAutomation = await automationStore.updateAutomation({
      id: automation.value.id,
      title: normalizedTitle.value || undefined,
      prompt: normalizedPrompt.value,
      status: status.value,
      workspaceId: workspaceId.value,
      modelId: modelId.value,
      trigger: {
        type: "schedule",
        schedule: schedule.value,
      },
    });

    applyFormState(updatedAutomation);
    saveState.value = "success";
    toast.success("已保存修改");
  } catch (error) {
    saveState.value = "error";
    toast.error(error instanceof Error ? error.message : "保存失败");
  } finally {
    isSaving.value = false;
  }
}

function openDeleteDialog() {
  if (!automation.value) {
    return;
  }

  openDialog(DeleteAutomation, {
    automation: automation.value,
    onDeleted: async () => {
      await router.push("/auto");
    },
  });
}

watch(
  () => route.params.automationId,
  async () => {
    await loadAutomation();
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex h-full flex-col items-center px-3 pb-3">
    <MainTitle>
      <button
        class="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        type="button"
        @click="backToList"
      >
        <span>自动化</span>
      </button>
      <span class="text-muted-foreground">›</span>
      <span class="truncate text-sm font-medium text-foreground">
        {{ automation?.title ?? "自动化详情" }}
      </span>

      <template #extra>
        <div class="flex items-center gap-2">
          <Button
            class="h-7"
            variant="ghost"
            size="icon"
            :disabled="!automation"
            @click="openDeleteDialog"
          >
            <Trash2 class="size-4" />
          </Button>
          <Button
            class="h-7"
            variant="outline"
            size="sm"
            :disabled="!automation || !isDirty || isSaving"
            @click="resetForm"
          >
            <RotateCcw class="size-4" />
            重置
          </Button>
          <Button
            class="h-7"
            size="sm"
            :disabled="!automation || !isDirty || !isValid || isSaving"
            @click="handleSave"
          >
            {{ isSaving ? "保存中..." : "保存" }}
          </Button>
        </div>
      </template>
    </MainTitle>

    <div class="w-full flex-1 overflow-y-auto px-3 pb-3">
      <div v-if="detailLoading" class="grid min-h-full grid-cols-[minmax(0,1fr)_320px] gap-8">
        <section class="space-y-6 pt-8">
          <Skeleton class="h-12 w-72" />
          <Skeleton class="h-6 w-full max-w-xl" />
          <Skeleton class="h-48 w-full rounded-2xl" />
        </section>
        <aside class="border-l pt-8 pl-8">
          <div class="space-y-6">
            <Skeleton class="h-6 w-24" />
            <Skeleton class="h-10 w-full rounded-xl" />
            <Skeleton class="h-10 w-full rounded-xl" />
            <Skeleton class="h-10 w-full rounded-xl" />
          </div>
        </aside>
      </div>

      <div
        v-else-if="notFound || !automation"
        class="flex min-h-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-card px-6 py-12 text-center"
      >
        <div class="text-sm font-semibold">未找到该自动化</div>
        <p class="max-w-md text-sm text-muted-foreground">
          这条自动化可能已被删除，或当前链接中的 id 无效。
        </p>
        <Button variant="outline" @click="backToList">
          <ArrowLeft class="size-4" />
          返回自动化列表
        </Button>
      </div>

      <div v-else class="grid min-h-full grid-cols-[minmax(0,1fr)_320px] gap-8">
        <section class="min-w-0 pt-2">
          <div class="flex h-full max-w-4xl flex-col space-y-4">
            <Input
              v-model="title"
              class="h-auto border-0 bg-transparent px-2 !text-3xl font-semibold tracking-tight text-foreground shadow-none focus-visible:ring-0"
              placeholder="自动化名称"
            />

            <Textarea
              v-model="prompt"
              class="min-h-[320px] flex-1 resize-none border-0 bg-transparent px-2 py-0 !text-base leading-9 text-foreground/90 shadow-none focus-visible:ring-0"
              placeholder="输入自动化执行时要发送给 AI 的提示词"
            />
          </div>
        </section>

        <aside class="border-l pt-8 pl-8">
          <div class="space-y-9">
            <section class="space-y-3">
              <div class="text-sm font-medium text-muted-foreground">Status</div>
              <div class="space-y-2">
                <div class="flex items-center justify-between gap-4 text-sm">
                  <span class="text-foreground">状态</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button
                        variant="ghost"
                        class="h-auto rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground"
                      >
                        <span>{{ selectedStatusLabel }}</span>
                        <ChevronsUpDown class="size-3.5 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        v-for="option in statusOptions"
                        :key="option.value"
                        class="justify-between"
                        @click="status = option.value"
                      >
                        <span>{{ option.label }}</span>
                        <Check v-if="option.value === status" class="size-4 text-primary" />
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div class="flex items-center justify-between gap-4 text-sm">
                  <span class="text-foreground">下次运行</span>
                  <span class="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                    {{ getAutomationNextRunLabel(automation) }}
                  </span>
                </div>
                <div class="flex items-center justify-between gap-4 text-sm">
                  <span class="text-foreground">上次运行</span>
                  <span class="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                    {{ getAutomationLastRunLabel(automation) }}
                  </span>
                </div>
              </div>
            </section>

            <section class="space-y-3">
              <div class="text-sm font-medium text-muted-foreground">详情</div>
              <div class="space-y-3 text-sm">
                <div class="flex items-start justify-between gap-6">
                  <span class="pt-2 text-foreground">工作空间</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button
                        variant="ghost"
                        class="h-auto max-w-[180px] justify-end rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground"
                      >
                        <span class="truncate">{{ selectedWorkspaceLabel }}</span>
                        <ChevronsUpDown class="size-3.5 shrink-0 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="min-w-[16rem]">
                      <DropdownMenuItem
                        v-for="workspace in workspaceList"
                        :key="workspace.id"
                        class="justify-between"
                        @click="workspaceId = workspace.id"
                      >
                        <span>{{ workspace.name }}</span>
                        <Check v-if="workspace.id === workspaceId" class="size-4 text-primary" />
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div class="space-y-2">
                  <div class="flex items-start justify-between gap-6">
                    <span class="pt-1 text-foreground">重复</span>
                    <span class="text-right text-muted-foreground">
                      {{ repeatLabel }}
                    </span>
                  </div>
                  <div class="space-y-3 rounded-xl border border-border/60 p-3">
                    <ToggleGroup
                      :model-value="scheduleMode"
                      type="single"
                      variant="outline"
                      class="grid w-full grid-cols-4"
                      @update:model-value="
                        (value) => {
                          if (value) scheduleMode = value as AutomationScheduleMode;
                        }
                      "
                    >
                      <ToggleGroupItem
                        value="daily_at"
                        class="h-7 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                      >
                        每天
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="hourly"
                        class="h-7 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                      >
                        每小时
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="weekly_at"
                        class="h-7 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                      >
                        每周
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="custom"
                        class="h-7 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                      >
                        自定义
                      </ToggleGroupItem>
                    </ToggleGroup>

                    <div v-if="scheduleMode === 'daily_at'">
                      <TimePicker id="automation-detail-daily-time" v-model="dailyTime" />
                    </div>

                    <div
                      v-else-if="scheduleMode === 'hourly'"
                      class="rounded-md border bg-muted/40 px-2.5 py-2 text-sm text-muted-foreground"
                    >
                      每小时整点执行一次。
                    </div>

                    <div v-else-if="scheduleMode === 'weekly_at'" class="space-y-3">
                      <TimePicker id="automation-detail-weekly-time" v-model="weeklyTime" />
                      <div class="flex flex-wrap justify-between">
                        <Button
                          v-for="day in automationWeekdayOptions"
                          :key="day.value"
                          :class="getWeekdayButtonClass(day.value)"
                          size="icon-sm"
                          variant="outline"
                          class="rounded-full"
                          @click="toggleWeeklyDay(day.value)"
                        >
                          {{ day.label }}
                        </Button>
                      </div>
                    </div>

                    <div v-else class="space-y-2">
                      <Input
                        v-model="customCronExpression"
                        class="h-8 py-0 text-sm"
                        placeholder="标准 cron 表达式，如: 0 9 * * *"
                      />
                    </div>

                    <p v-if="weeklyDaysError || customCronError" class="text-xs text-destructive">
                      {{ weeklyDaysError || customCronError }}
                    </p>
                  </div>
                </div>

                <div class="space-y-2">
                  <div class="flex items-start justify-between gap-6">
                    <span class="pt-2 text-foreground">模型</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <Button
                          variant="ghost"
                          class="h-auto max-w-[180px] justify-end rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground"
                        >
                          <span class="truncate">{{ selectedModelLabel }}</span>
                          <ChevronsUpDown class="size-3.5 shrink-0 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" class="min-w-[16rem]">
                        <DropdownMenuItem class="justify-between" @click="modelId = null">
                          <span>使用默认模型</span>
                          <Check v-if="modelId === null" class="size-4 text-primary" />
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          v-for="model in modelList"
                          :key="model.modelId"
                          class="justify-between"
                          @click="modelId = model.modelId"
                        >
                          <span>{{ model.name }}</span>
                          <Check v-if="model.modelId === modelId" class="size-4 text-primary" />
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p class="text-right text-xs text-muted-foreground">{{ modelHint }}</p>
                </div>

                <div class="flex items-center justify-between gap-6 text-sm">
                  <span class="text-foreground">推理</span>
                  <Badge variant="secondary" class="rounded-full px-3 py-1 text-xs font-normal">
                    {{ reasoningSummary }}
                  </Badge>
                </div>
              </div>
            </section>

            <section class="space-y-3">
              <div class="text-sm font-medium text-muted-foreground">执行历史</div>
              <div class="space-y-2 text-sm text-muted-foreground">
                <div>
                  {{ getAutomationRunKindLabel(automation.latestRun) }}: {{ previousRunText }}
                </div>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>
