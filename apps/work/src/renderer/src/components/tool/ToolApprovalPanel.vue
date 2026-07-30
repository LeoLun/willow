<script setup lang="ts">
import type { ToolApprovalDecision, ToolApprovalEventPayload } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import { Bot, CircleAlert, LoaderCircle, SquareTerminal } from "lucide-vue-next";
import { computed, ref } from "vue";

const props = defineProps<{
  request: ToolApprovalEventPayload;
  onDecision: (decision: ToolApprovalDecision) => Promise<void>;
}>();

const submitting = ref(false);
const errorMessage = ref("");
const reasonLabel = computed(() => {
  const labels = {
    "outside-workspace-read": "读取目标位于工作区外",
    "outside-workspace-write": "写入目标位于工作区外",
    "network-domain": "目标域名不在网络允许列表中",
    "application-launch": "启动或控制外部应用",
    "sandbox-denied": "沙箱拒绝了命令",
  } satisfies Record<ToolApprovalEventPayload["reason"], string>;
  return labels[props.request.reason];
});
const partialEffectsMessage = computed(() =>
  props.request.reason === "application-launch"
    ? "沙箱内的首轮执行可能已经产生部分工作区内副作用；允许后将仅为本次工具调用开启应用启动与 Apple Events 能力，并在沙箱中完整重跑该命令。"
    : "沙箱内的首轮执行可能已经产生部分工作区内副作用；允许后将仅放行上述资源，并在沙箱中完整重跑该命令。",
);

async function decide(decision: ToolApprovalDecision): Promise<void> {
  if (submitting.value) return;
  submitting.value = true;
  errorMessage.value = "";
  try {
    await props.onDecision(decision);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "提交审批结果失败";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section
    class="grid max-h-[min(28rem,calc(100vh-8rem))] gap-4 overflow-y-auto rounded-[1.25rem] border border-border bg-background p-4 shadow-xl"
    data-slot="tool-approval-panel"
    aria-labelledby="tool-approval-title"
  >
    <div class="grid gap-3">
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <SquareTerminal class="size-4" aria-hidden="true" />
        <span>{{ request.toolName }}工具权限申请</span>
      </div>

      <div class="grid gap-1.5">
        <h2 id="tool-approval-title" class="text-sm font-medium">
          {{ reasonLabel }}
        </h2>
      </div>

      <pre
        class="max-h-40 overflow-auto rounded-lg bg-muted/45 px-3 py-2 font-mono text-xs leading-5 break-all whitespace-pre-wrap text-muted-foreground"
        data-slot="tool-approval-command"
        >{{ request.display }}</pre
      >

      <div
        v-if="request.aiReview"
        class="border-warning/30 bg-warning/5 grid gap-2 rounded-lg border p-3 text-sm"
        data-slot="ai-approval-review"
      >
        <div class="flex items-center gap-2 font-medium">
          <Bot class="size-4" aria-hidden="true" />
          {{ request.aiReview.status === "rejected" ? "AI 未批准" : "AI 审批不可用" }}
        </div>
        <p class="break-words text-muted-foreground">{{ request.aiReview.reason }}</p>
      </div>

      <div
        v-if="request.mayHavePartialEffects"
        class="border-warning/30 bg-warning/5 rounded-lg border p-3 text-sm"
      >
        {{ partialEffectsMessage }}
      </div>

      <div
        v-if="errorMessage"
        class="flex items-center gap-2 text-sm text-destructive"
        role="alert"
      >
        <CircleAlert class="size-4 shrink-0" aria-hidden="true" />
        <span>{{ errorMessage }}</span>
      </div>
    </div>

    <div class="flex justify-end gap-2">
      <Button type="button" variant="outline" :disabled="submitting" @click="decide('deny')">
        拒绝
      </Button>
      <Button
        type="button"
        :disabled="submitting"
        :aria-busy="submitting || undefined"
        @click="decide('allow')"
      >
        <LoaderCircle v-if="submitting" class="animate-spin" aria-hidden="true" />
        仅本次允许
      </Button>
    </div>
  </section>
</template>
