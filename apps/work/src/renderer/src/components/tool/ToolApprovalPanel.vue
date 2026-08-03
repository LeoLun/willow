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
    "executable-install": "安装或替换用户可执行文件",
    "process-inspection": "查看沙箱外的进程信息",
    "local-network-listen": "监听本机回环网络端口",
    "interactive-terminal": "启用交互式终端能力",
    "sandbox-denied": "沙箱拒绝了命令",
  } satisfies Record<ToolApprovalEventPayload["reason"], string>;
  return labels[props.request.reason];
});
const partialEffectsMessage = computed(() => {
  const messages = {
    "application-launch":
      "沙箱内的首轮执行可能已经产生部分工作区内副作用；允许后将仅为本次工具调用开启应用启动与 Apple Events 能力，并在沙箱中完整重跑该命令。",
    "executable-install":
      "该路径通常位于 PATH 中，写入后可能形成持久化代码执行入口；允许后仅对本次工具调用放行该目标，并在沙箱中完整重跑命令。",
    "process-inspection":
      "允许后将仅为本次工具调用开放进程信息读取，不开放浏览器所需的完整 Mach IPC 或 IOKit 权限。",
    "local-network-listen":
      "允许后将仅为本次工具调用开放本机回环监听与访问，外部网络仍受域名允许列表限制。",
    "interactive-terminal": "允许后将仅为本次工具调用开放伪终端设备；终端不会接收用户键盘输入。",
    "outside-workspace-read":
      "沙箱内的首轮执行可能已经产生部分工作区内副作用；允许后将仅放行上述资源，并在沙箱中完整重跑该命令。",
    "outside-workspace-write":
      "沙箱内的首轮执行可能已经产生部分工作区内副作用；允许后将仅放行上述资源，并在沙箱中完整重跑该命令。",
    "network-domain":
      "沙箱内的首轮执行可能已经产生部分工作区内副作用；允许后将仅放行上述资源，并在沙箱中完整重跑该命令。",
    "sandbox-denied":
      "沙箱内的首轮执行可能已经产生部分工作区内副作用；允许后将仅放行上述资源，并在沙箱中完整重跑该命令。",
  } satisfies Record<ToolApprovalEventPayload["reason"], string>;
  return messages[props.request.reason];
});

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

      <p
        v-if="request.mayHavePartialEffects || request.reason === 'process-inspection'"
        class="text-xs leading-5 text-muted-foreground"
        data-slot="tool-approval-partial-effects"
      >
        {{ partialEffectsMessage }}
      </p>

      <div
        v-if="request.aiReview"
        class="border-warning/30 bg-warning/5 grid gap-2 text-xs"
        data-slot="ai-approval-review"
      >
        <div class="flex items-start gap-1.5 leading-5">
          <Bot class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p class="min-w-0 break-words">
            <span
              >{{ request.aiReview.status === "rejected" ? "AI 未批准" : "AI 审批不可用" }}：</span
            >
            <span class="text-muted-foreground">{{ request.aiReview.reason }}</span>
          </p>
        </div>
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
