<script setup lang="ts">
import { Button } from "@willow/shadcn";
import { Pencil, X } from "lucide-vue-next";
import { ref } from "vue";

interface ToolApproval {
  toolCallId: string;
  toolName: string;
  arguments: unknown;
  title: string;
  reason: string;
  risk: "medium" | "high";
  status: "pending" | "approved" | "rejected";
}

const props = defineProps<{
  approvals: ToolApproval[];
}>();

const emit = defineEmits<{
  approve: [toolCallId: string];
  reject: [toolCallId: string, reason?: string];
  skip: [];
  close: [];
}>();

const rejectReason = ref("");

function handleReject() {
  const id = props.approvals[0]?.toolCallId;
  if (id) {
    emit("reject", id, rejectReason.value || undefined);
  }
}
</script>

<template>
  <div
    class="w-full rounded-xl border bg-background p-6"
    style="box-shadow: 0 10px 28px rgba(0, 0, 0, 0.078)"
  >
    <!-- Header -->
    <div class="flex w-full items-center justify-between gap-4">
      <div
        class="min-w-0 flex-1 truncate text-base font-semibold text-foreground"
        :title="approvals[0]?.title || '工具调用等待审批'"
      >
        {{ approvals[0]?.title || "工具调用等待审批" }}
      </div>
      <Button variant="ghost" size="icon-sm" class="size-8" @click="emit('close')">
        <X class="size-5" />
      </Button>
    </div>

    <!-- Choice List -->
    <div class="flex w-full flex-col pt-2">
      <div
        v-for="(approval, index) in approvals"
        :key="approval.toolCallId"
        class="flex cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-muted/30"
        @click="emit('approve', approval.toolCallId)"
      >
        <div class="flex size-7 shrink-0 items-center justify-center rounded-sm bg-muted">
          <span class="text-4 font-medium text-muted-foreground">
            {{ index + 1 }}
          </span>
        </div>
        <span class="shrink-0 text-base text-foreground">允许</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex w-full flex-row items-center gap-3 pt-2">
      <div class="flex flex-1 items-center gap-3 rounded-xl p-2">
        <div class="flex flex-1 items-center gap-3">
          <div class="flex size-7 shrink-0 items-center justify-center rounded-sm bg-muted">
            <Pencil class="size-4 text-muted-foreground" />
          </div>
          <input
            v-model="rejectReason"
            class="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="否，请告诉 AI 怎么处理"
            @keydown.enter="handleReject"
          />
        </div>
      </div>
      <div>
        <Button
          v-if="rejectReason.length <= 0"
          variant="outline"
          class="rounded-[19px]"
          @click="emit('skip')"
        >
          跳过
        </Button>
        <Button v-else class="rounded-[19px]" @click="handleReject"> 提交 </Button>
      </div>
    </div>
  </div>
</template>
