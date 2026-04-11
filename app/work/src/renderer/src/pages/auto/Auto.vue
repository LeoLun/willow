<script setup lang="ts">
import type { Automation } from "@shared/api";
import { Bot, Circle, Copy, Ellipsis, Pencil, Plus, Trash2 } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { computed, onBeforeMount, ref } from "vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useDialog } from "@/layout/dialog";
import { AutomationForm } from "@/layout/dialog/automation-form";
import { DeleteAutomation } from "@/layout/dialog/delete-automation";
import { useAutomationStore } from "@/stores/automation";
import { useWorkspaceStore } from "@/stores/workspace";

const automationStore = useAutomationStore();
const workspaceStore = useWorkspaceStore();
const { openDialog } = useDialog();
const { automationList, loading } = storeToRefs(automationStore);
const { workspaceList } = storeToRefs(workspaceStore);
const activeMenuAutomationId = ref<number | null>(null);

onBeforeMount(async () => {
  await Promise.all([automationStore.fetchAutomationList(), workspaceStore.fetchWorkspaceList()]);
});

const workspaceMap = computed(
  () => new Map(workspaceList.value.map((workspace) => [workspace.id, workspace.name])),
);

function openCreateDialog() {
  activeMenuAutomationId.value = null;
  openDialog(AutomationForm, {
    workspaces: workspaceList.value,
    onCreated: () => automationStore.fetchAutomationList(),
  });
}

function openEditDialog(automation: Automation) {
  activeMenuAutomationId.value = null;
  openDialog(AutomationForm, {
    workspaces: workspaceList.value,
    automation,
    onSaved: () => automationStore.fetchAutomationList(),
  });
}

function workspaceName(workspaceId: number) {
  return workspaceMap.value.get(workspaceId) ?? `工作空间 #${workspaceId}`;
}

async function deleteAutomation(automation: Automation) {
  activeMenuAutomationId.value = null;
  openDialog(DeleteAutomation, {
    automation,
    onDeleted: () => automationStore.fetchAutomationList(),
  });
}

async function duplicateAutomation(automation: Automation) {
  activeMenuAutomationId.value = null;
  await automationStore.createAutomation({
    workspaceId: automation.workspaceId,
    prompt: automation.prompt,
    trigger: {
      type: "schedule",
      schedule: inferScheduleFromAutomation(automation),
    },
    status: automation.status,
  });
}

function rowMeta(automation: Automation) {
  const workspace = workspaceName(automation.workspaceId);
  const summary = automation.trigger
    ? formatCompactTime(automation.trigger.cronExpression)
    : "未配置计划";
  return `${workspace} · ${automation.prompt}`;
}

function rightTimeLabel(automation: Automation) {
  if (!automation.trigger) {
    return "未配置";
  }
  return formatCompactTime(automation.trigger.cronExpression);
}

function formatCompactTime(cronExpression: string) {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return cronExpression;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  if (minute === "0" && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return "每小时";
  }

  if (
    /^\d+$/.test(minute) &&
    /^\d+$/.test(hour) &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    return `每天 ${Number(hour)}:${minute.padStart(2, "0")}`;
  }

  if (
    /^\d+$/.test(minute) &&
    /^\d+$/.test(hour) &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek !== "*"
  ) {
    const weekdays = dayOfWeek
      .split(",")
      .map((value) => weekdayLabel(value))
      .filter(Boolean)
      .join("、");
    return weekdays ? `每周${weekdays} ${Number(hour)}:${minute.padStart(2, "0")}` : cronExpression;
  }

  return cronExpression;
}

function weekdayLabel(value: string) {
  const mapping: Record<string, string> = {
    "0": "日",
    "1": "一",
    "2": "二",
    "3": "三",
    "4": "四",
    "5": "五",
    "6": "六",
    "7": "日",
  };
  return mapping[value] ?? "";
}

function inferScheduleFromAutomation(automation: Automation) {
  const cronExpression = automation.trigger?.cronExpression ?? "";
  const parts = cronExpression.trim().split(/\s+/);

  if (parts.length === 5) {
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    if (
      minute === "0" &&
      hour === "*" &&
      dayOfMonth === "*" &&
      month === "*" &&
      dayOfWeek === "*"
    ) {
      return { mode: "hourly" as const, cronExpression };
    }
    if (
      /^\d+$/.test(minute) &&
      /^\d+$/.test(hour) &&
      dayOfMonth === "*" &&
      month === "*" &&
      dayOfWeek === "*"
    ) {
      return {
        mode: "daily_at" as const,
        cronExpression,
        dailyTime: `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`,
      };
    }
    if (
      /^\d+$/.test(minute) &&
      /^\d+$/.test(hour) &&
      dayOfMonth === "*" &&
      month === "*" &&
      dayOfWeek !== "*"
    ) {
      return {
        mode: "weekly_at" as const,
        cronExpression,
        weeklyDays: dayOfWeek
          .split(",")
          .filter(Boolean)
          .map((value) => Number(value)),
      };
    }
  }

  return {
    mode: "custom" as const,
    cronExpression,
  };
}

function setMenuOpen(automationId: number, open: boolean) {
  activeMenuAutomationId.value = open ? automationId : null;
}

function isRowActive(automationId: number) {
  return activeMenuAutomationId.value === automationId;
}
</script>

<template>
  <div class="mx-auto flex h-full w-full max-w-5xl flex-col gap-6 p-6 md:p-8">
    <header class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">自动化</h1>
        <p class="max-w-2xl text-sm text-muted-foreground">
          把常用提示词绑定到工作空间，按固定节奏自动执行。
        </p>
      </div>
      <Button size="icon" class="rounded-full" @click="openCreateDialog">
        <Plus class="size-4" />
      </Button>
    </header>

    <section v-if="loading" class="grid gap-4">
      <Card v-for="index in 3" :key="index">
        <CardHeader class="space-y-3">
          <Skeleton class="h-5 w-48" />
          <Skeleton class="h-4 w-72" />
        </CardHeader>
        <CardContent class="grid gap-3">
          <Skeleton class="h-4 w-full" />
          <Skeleton class="h-4 w-2/3" />
        </CardContent>
      </Card>
    </section>

    <section v-else-if="automationList.length === 0">
      <Card class="border-dashed bg-muted/20">
        <CardHeader class="items-start gap-3">
          <div class="flex size-10 items-center justify-center rounded-full border bg-background">
            <Bot class="size-5 text-muted-foreground" />
          </div>
          <div class="space-y-1">
            <CardTitle>还没有自动化</CardTitle>
            <CardDescription>
              创建第一条自动化后，Willow 会按你设定的计划把提示词发送到对应工作空间。
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button class="gap-2" @click="openCreateDialog">
            <Plus class="size-4" />
            创建第一条自动化
          </Button>
        </CardContent>
      </Card>
    </section>

    <section v-else class="grid gap-2">
      <div
        v-for="automation in automationList"
        :key="automation.id"
        class="group flex items-center gap-4 rounded-xl border border-transparent px-2 py-1 transition-all hover:border-border/80 hover:bg-muted/35"
        :class="{
          'border-border/80 bg-muted/35': isRowActive(automation.id),
          'opacity-60': automation.status !== 'enabled',
        }"
      >
        <div class="min-w-0 flex-1 overflow-hidden">
          <div class="flex items-baseline gap-3 overflow-hidden">
            <span class="truncate text-lg font-semibold tracking-tight">
              {{ automation.title }}
            </span>
            <span class="truncate text-base text-muted-foreground">
              {{ rowMeta(automation) }}
            </span>
          </div>
        </div>

        <div
          class="shrink-0 items-center gap-1 text-muted-foreground"
          :class="isRowActive(automation.id) ? 'flex' : 'hidden group-hover:flex'"
        >
          <Button
            variant="ghost"
            size="icon"
            class="size-6 rounded-full"
            @click="openEditDialog(automation)"
          >
            <Pencil class="size-4" />
          </Button>

          <DropdownMenu @update:open="setMenuOpen(automation.id, $event)">
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon" class="size-6 rounded-full">
                <Ellipsis class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-36">
              <DropdownMenuItem @click="duplicateAutomation(automation)">
                <Copy class="size-4" />
                复制
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" @click="deleteAutomation(automation)">
                <Trash2 class="size-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div
          class="shrink-0 text-base text-muted-foreground"
          :class="isRowActive(automation.id) ? 'hidden' : 'group-hover:hidden'"
        >
          {{ rightTimeLabel(automation) }}
        </div>
      </div>
    </section>
  </div>
</template>
