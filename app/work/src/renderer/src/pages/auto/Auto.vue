<script setup lang="ts">
import type { Automation } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import { Card, CardContent } from "@willow/shadcn/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@willow/shadcn/components/ui/dropdown-menu";
import { Label } from "@willow/shadcn/components/ui/label";
import { Separator } from "@willow/shadcn/components/ui/separator";
import {
  BookOpenText,
  Brain,
  Calendar,
  Copy,
  Ellipsis,
  MessageSquareText,
  Pencil,
  Plus,
  SquareTerminal,
  TrendingUp,
  Trophy,
  Trash2,
} from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { computed, onBeforeMount, ref } from "vue";
import { useRouter } from "vue-router";
import { formatAutomationSchedule, getAutomationRowMeta } from "@/components/automation/display";
import type { AutomationTemplatePresetInput } from "@/components/automation/template-preset";
import type { AutomationTemplatePreset } from "@/components/automation/template-preset";
import MainTitle from "@/components/base/MainTitle.vue";
import { useDialog } from "@/layout/dialog";
import { AutomationForm } from "@/layout/dialog/automation-form";
import { DeleteAutomation } from "@/layout/dialog/delete-automation";
import { useAutomationStore } from "@/stores/automation";
import { useWorkspaceStore } from "@/stores/workspace";

const automationStore = useAutomationStore();
const workspaceStore = useWorkspaceStore();
const router = useRouter();
const { openDialog } = useDialog();
const { automationList } = storeToRefs(automationStore);
const { workspaceList } = storeToRefs(workspaceStore);
const activeMenuAutomationId = ref<number | null>(null);
const exampleTemplates: AutomationTemplatePreset[] = [
  {
    id: "daily-focus-plan",
    title: "整理今日重点计划",
    description: "根据你的任务和日历，制定一份专注执行计划。",
    icon: Calendar,
    iconClass: "text-sky-500",
    preset: {
      title: "整理今日重点计划",
      prompt:
        "请根据我当前工作空间中的任务清单和日历安排，生成一份今天的重点执行计划。输出优先级排序、每项预计时长，以及建议的开始时间。",
      scheduleMode: "daily_at",
      dailyTime: "09:00",
      cronExpression: "0 9 * * *",
    },
  },
  {
    id: "unread-reply-draft",
    title: "总结未读并起草回复",
    description: "总结未读消息并起草简短回复。",
    icon: BookOpenText,
    iconClass: "text-emerald-500",
    preset: {
      title: "总结未读并起草回复",
      prompt: "请汇总最近未读消息，按主题分类，并为每个主题起草 1-2 条可直接发送的简短回复。",
      scheduleMode: "hourly",
      cronExpression: "0 * * * *",
    },
  },
  {
    id: "meeting-prep",
    title: "生成明日会议准备要点",
    description: "生成明天会议的准备要点。",
    icon: MessageSquareText,
    iconClass: "text-blue-500",
    preset: {
      title: "生成明日会议准备要点",
      prompt:
        "请根据当前项目上下文，整理我明天会议前的准备要点。输出：会议目标、关键问题、需要确认的事项、建议发言提纲。",
      scheduleMode: "daily_at",
      dailyTime: "18:00",
      cronExpression: "0 18 * * *",
    },
  },
  {
    id: "friday-recap",
    title: "生成周五复盘",
    description: "生成周五总结：成果、阻碍与下一步。",
    icon: TrendingUp,
    iconClass: "text-slate-700",
    preset: {
      title: "生成周五复盘",
      prompt:
        "请帮我生成本周复盘，结构包含：本周成果（wins）、当前阻碍（blockers）、下周下一步（next steps）。要求简洁、可执行。",
      scheduleMode: "weekly_at",
      weeklyTime: "17:30",
      weeklyDays: ["5"],
      cronExpression: "30 17 * * 5",
    },
  },
  {
    id: "weekly-digest",
    title: "整理每周知识摘要",
    description: "将收藏链接和笔记整理成每周摘要。",
    icon: Trophy,
    iconClass: "text-amber-500",
    preset: {
      title: "整理每周知识摘要",
      prompt:
        "请把我本周保存的链接和笔记整理成一份周报摘要，按主题分组，并给出每个主题的关键结论与后续行动建议。",
      scheduleMode: "weekly_at",
      weeklyTime: "20:00",
      weeklyDays: ["0"],
      cronExpression: "0 20 * * 0",
    },
  },
  {
    id: "accountability-check",
    title: "日内执行检查",
    description: "在一天中进行快速执行检查。",
    icon: Brain,
    iconClass: "text-fuchsia-500",
    preset: {
      title: "日内执行检查",
      prompt:
        "请做一次简短执行检查：我当前正在做什么、是否偏离今日重点、接下来 2 小时最关键的一步是什么。",
      scheduleMode: "daily_at",
      dailyTime: "12:00",
      cronExpression: "0 12 * * *",
    },
  },
];

onBeforeMount(async () => {
  await Promise.all([automationStore.fetchAutomationList(), workspaceStore.fetchWorkspaceList()]);
});

const workspaceMap = computed(
  () => new Map(workspaceList.value.map((workspace) => [workspace.id, workspace.name])),
);

function openCreateDialog(preset?: AutomationTemplatePresetInput) {
  activeMenuAutomationId.value = null;
  openDialog(AutomationForm, {
    workspaces: workspaceList.value,
    preset,
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

function openDetail(automation: Automation) {
  router.push(`/auto/${automation.id}`);
}

function rightTimeLabel(automation: Automation) {
  if (!automation.trigger) {
    return "未配置";
  }
  return formatAutomationSchedule(automation.trigger.cronExpression);
}

function rowMeta(automation: Automation) {
  return getAutomationRowMeta(automation, workspaceName(automation.workspaceId));
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
  <div class="flex h-full flex-col items-center px-3 pb-3">
    <MainTitle>
      <div></div>
      <template #extra>
        <Button class="h-7" size="sm" @click="openCreateDialog()">
          <Plus class="size-5" />
          添加自动化
        </Button>
      </template>
    </MainTitle>

    <section
      v-if="automationList.length === 0"
      class="flex w-full flex-col items-center gap-5 py-4"
    >
      <div class="mt-[6%] flex flex-col items-center space-y-2">
        <SquareTerminal class="size-12 text-muted-foreground" />
        <div class="text-center text-2xl font-semibold">自动化</div>
        <div class="text-center text-sm text-muted-foreground">
          你可以先选择一个示例模板，或点击右上角创建自己的自动化。
        </div>
      </div>

      <div class="grid w-[80%] gap-3 md:grid-cols-2">
        <Card
          v-for="example in exampleTemplates"
          :key="example.id"
          class="cursor-pointer py-4 hover:bg-muted/40"
          @click="openCreateDialog(example.preset)"
        >
          <CardContent class="flex flex-col gap-4 px-4">
            <div
              class="inline-flex size-10 items-center justify-center rounded-lg border bg-background"
            >
              <component :is="example.icon" class="size-5" :class="example.iconClass" />
            </div>
            <div class="space-y-1.5">
              <p class="text-base leading-none font-medium">{{ example.title }}</p>
              <p class="text-sm text-muted-foreground">{{ example.description }}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>

    <div v-else class="mt-10 flex w-full flex-col items-center overflow-hidden">
      <div class="w-[80%] text-2xl font-semibold">自动化</div>
      <Separator class="my-2 !w-[80%]" />
      <section class="flex w-full flex-col items-center gap-2 overflow-y-auto">
        <div
          v-for="automation in automationList"
          :key="automation.id"
          class="group flex w-[80%] cursor-pointer items-center gap-4 rounded-md px-2 py-1 transition-all hover:bg-muted"
          :class="{
            'border-border/80 bg-muted/35': isRowActive(automation.id),
            'opacity-60': automation.status !== 'enabled',
          }"
          @click="openDetail(automation)"
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

          <div class="shrink-0 text-base text-muted-foreground">
            {{ rightTimeLabel(automation) }}
          </div>

          <div class="shrink-0 items-center gap-1 text-muted-foreground">
            <Button
              variant="ghost"
              size="icon"
              class="size-6 rounded-full"
              @click.stop="openEditDialog(automation)"
            >
              <Pencil class="size-4" />
            </Button>

            <DropdownMenu @update:open="setMenuOpen(automation.id, $event)">
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon" class="size-6 rounded-full" @click.stop>
                  <Ellipsis class="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-36">
                <DropdownMenuItem @click.stop="duplicateAutomation(automation)">
                  <Copy class="size-4" />
                  复制
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" @click.stop="deleteAutomation(automation)">
                  <Trash2 class="size-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
