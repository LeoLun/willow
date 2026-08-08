<script setup lang="ts">
import type { AutomationListItem } from "@shared/api";
import { Badge } from "@willow/shadcn/components/ui/badge";
import { Button as ShadcnButton } from "@willow/shadcn/components/ui/button";
import { Skeleton } from "@willow/shadcn/components/ui/skeleton";
import { Switch } from "@willow/shadcn/components/ui/switch";
import { CalendarClock, Clock3, Pencil, Plus, RefreshCw, Trash2 } from "lucide-vue-next";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import AutomationDetailPanel from "@/components/automation/AutomationDetailPanel.vue";
import { useDialog } from "@/components/dialog";
import DeleteAutomationDialog from "@/components/dialog/automation/DeleteAutomationDialog.vue";
import BaseHeader from "@/components/layout/BaseHeader.vue";
import { Button } from "@/components/ui/button";
import { useAutomationList } from "@/composables/useAutomation";
import { requestGuidedPrompt } from "@/lib/app-state-events";
import { GUIDED_AUTOMATION_TEMPLATE } from "@/lib/automation-guide";
import {
  AUTOMATION_RUN_STATUS_LABELS,
  describeCronSchedule,
  formatDateTime,
} from "@/lib/automation-schedule";
import { electronAPI } from "@/lib/ipc";

const route = useRoute();
const router = useRouter();
const { openDialog } = useDialog();
const { automations, loading, loadError, loadAutomations } = useAutomationList();
const pendingStatusIds = new Set<number>();

const selectedAutomationId = computed(() => {
  const value = Number(route.params.automationId);
  return Number.isInteger(value) && value > 0 ? value : undefined;
});

function startGuidedCreation() {
  requestGuidedPrompt(GUIDED_AUTOMATION_TEMPLATE);
  void router.push({ name: "home" });
}

function openDetail(automation: AutomationListItem) {
  void router.push({ name: "auto", params: { automationId: String(automation.id) } });
}

function closeDetail() {
  void router.push({ name: "auto" });
}

function handleDetailDeleted() {
  closeDetail();
  void loadAutomations();
}

function openDeleteDialog(automation: AutomationListItem) {
  openDialog(
    DeleteAutomationDialog,
    {
      automationId: automation.id,
      title: automation.title,
      onDeleted: () => void loadAutomations(),
    },
    { contentClass: "sm:max-w-md" },
  );
}

async function toggleStatus(automation: AutomationListItem, enabled: boolean) {
  if (pendingStatusIds.has(automation.id)) return;
  pendingStatusIds.add(automation.id);
  try {
    await electronAPI.updateAutomation({
      id: automation.id,
      status: enabled ? "enabled" : "disabled",
    });
    await loadAutomations();
  } catch (error) {
    console.error("Failed to toggle automation status:", error);
  } finally {
    pendingStatusIds.delete(automation.id);
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 bg-background" data-slot="automation-page">
    <div class="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <BaseHeader />
      <div class="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <main class="mx-auto w-full max-w-5xl px-6 pt-6 pb-16 sm:px-10 lg:px-14">
          <header class="flex items-end justify-between gap-4">
            <div>
              <h1 class="text-2xl font-semibold tracking-tight text-foreground">自动化</h1>
              <p class="mt-2 text-sm text-muted-foreground">按计划自动执行任务，无人值守运行</p>
            </div>
            <ShadcnButton data-slot="create-automation-button" @click="startGuidedCreation">
              <Plus aria-hidden="true" />
              添加自动化
            </ShadcnButton>
          </header>

          <div v-if="loading" class="mt-4" data-slot="automation-loading">
            <Skeleton class="h-20 rounded-2xl" />
            <Skeleton class="mt-3 h-20 rounded-2xl" />
            <Skeleton class="mt-3 h-20 rounded-2xl" />
          </div>

          <section
            v-else-if="loadError"
            class="mt-4 flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed px-6 text-center"
            data-slot="automation-error"
            role="alert"
          >
            <Clock3 class="size-10 text-muted-foreground" aria-hidden="true" />
            <p class="mt-4 text-sm font-medium text-foreground">自动化加载失败</p>
            <p class="mt-1 text-sm text-muted-foreground">{{ loadError }}</p>
            <Button
              variant="secondary"
              class="mt-5"
              data-slot="automation-retry"
              @click="loadAutomations"
            >
              <RefreshCw aria-hidden="true" />
              重试
            </Button>
          </section>

          <section
            v-else-if="automations.length === 0"
            class="mt-4 flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed px-6 text-center"
            data-slot="automation-empty"
          >
            <Clock3 class="size-10 text-muted-foreground" aria-hidden="true" />
            <p class="mt-4 text-sm font-medium text-foreground">暂无自动化</p>
            <p class="mt-1 text-sm text-muted-foreground">
              添加自动化后，Willow 会按计划自动执行任务
            </p>
            <ShadcnButton class="mt-5" @click="startGuidedCreation">
              <Plus aria-hidden="true" />
              添加自动化
            </ShadcnButton>
          </section>

          <div v-else class="mt-4 grid gap-3" data-slot="automation-list">
            <article
              v-for="automation in automations"
              :key="automation.id"
              class="group cursor-pointer rounded-xl border bg-card p-3 transition-colors hover:bg-accent/40"
              :data-slot="`automation-item-${automation.id}`"
              @click="openDetail(automation)"
            >
              <div class="flex min-w-0 items-center gap-4">
                <div class="min-w-0 flex-1">
                  <div class="flex min-w-0 items-center gap-2">
                    <h2 class="truncate text-sm font-medium text-foreground">
                      {{ automation.title }}
                    </h2>
                    <Badge variant="outline" class="shrink-0 font-normal text-muted-foreground">
                      {{ automation.workspaceName || "未知工作空间" }}
                    </Badge>
                  </div>
                  <p class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock class="size-3.5 shrink-0" aria-hidden="true" />
                    {{ describeCronSchedule(automation.cronExpression) }}
                    <span class="text-muted-foreground/60">·</span>
                    {{ automation.timezone }}
                  </p>
                  <div
                    class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
                  >
                    <span>
                      下次执行：
                      {{
                        automation.status === "enabled" && automation.nextRunAt
                          ? formatDateTime(automation.nextRunAt, automation.timezone)
                          : "—"
                      }}
                    </span>
                    <span v-if="automation.lastRun">
                      最近：
                      <Badge
                        variant="secondary"
                        class="px-1.5 py-0 text-[11px] font-normal"
                        :class="
                          automation.lastRun.status === 'failed' ||
                          automation.lastRun.status === 'interrupted'
                            ? 'bg-destructive/10 text-destructive'
                            : ''
                        "
                      >
                        {{ AUTOMATION_RUN_STATUS_LABELS[automation.lastRun.status] }}
                      </Badge>
                    </span>
                    <span v-else>从未运行</span>
                  </div>
                </div>

                <Switch
                  class="shrink-0"
                  :model-value="automation.status === 'enabled'"
                  :disabled="pendingStatusIds.has(automation.id)"
                  :aria-label="`${automation.status === 'enabled' ? '停用' : '启用'} ${automation.title}`"
                  data-slot="automation-status-switch"
                  @update:model-value="(value: boolean) => toggleStatus(automation, value)"
                  @click.stop
                />

                <div class="flex shrink-0 items-center gap-1" @click.stop>
                  <ShadcnButton
                    variant="ghost"
                    size="icon"
                    class="size-8 text-destructive hover:text-destructive"
                    aria-label="删除自动化"
                    title="删除"
                    @click="openDeleteDialog(automation)"
                  >
                    <Trash2 class="size-4" aria-hidden="true" />
                  </ShadcnButton>
                </div>
              </div>
            </article>
          </div>
        </main>
      </div>
    </div>

    <AutomationDetailPanel
      v-if="selectedAutomationId !== undefined"
      :key="selectedAutomationId"
      :automation-id="selectedAutomationId"
      @close="closeDetail"
      @deleted="handleDetailDeleted"
    />
  </div>
</template>
