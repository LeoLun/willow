<script setup lang="ts">
import { Button } from "@willow/shadcn";
import { Pencil, X } from "lucide-vue-next";
import { ref, computed } from "vue";

interface AskUserApproval {
  toolCallId: string;
  toolName: string;
  arguments: unknown;
  title: string;
  status: "pending" | "approved" | "rejected";
}

const props = withDefaults(
  defineProps<{
    approval: AskUserApproval;
    compact?: boolean;
  }>(),
  {
    compact: false,
  },
);

const emit = defineEmits<{
  resolve: [decision: "approved" | "rejected", answer?: string];
  close: [];
}>();

const customText = ref("");

const options = computed<string[]>(() => {
  const args = props.approval.arguments;
  if (args && typeof args === "object" && "options" in args && Array.isArray(args.options)) {
    return args.options.filter((opt): opt is string => typeof opt === "string");
  }
  return [];
});

function handleSubmit() {
  const text = customText.value.trim();
  if (text) {
    emit("resolve", "approved", text);
  } else {
    emit("resolve", "rejected");
  }
}

function handleKeydownEnter() {
  if (customText.value.trim()) {
    handleSubmit();
  }
}
</script>

<template>
  <div
    class="w-full rounded-xl border bg-background"
    :class="compact ? 'p-3' : 'p-6'"
    style="box-shadow: 0 10px 28px rgba(0, 0, 0, 0.078)"
  >
    <!-- Header -->
    <div class="flex w-full items-center justify-between gap-4">
      <div
        class="min-w-0 flex-1 truncate font-semibold text-foreground"
        :class="compact ? 'text-sm' : 'text-base'"
        :title="approval.title || '问题反馈'"
      >
        {{ approval.title || "问题反馈" }}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        :class="compact ? 'size-7' : 'size-8'"
        @click="emit('close')"
      >
        <X :class="compact ? 'size-4' : 'size-5'" />
      </Button>
    </div>

    <!-- Choice List -->
    <div class="flex w-full flex-col" :class="compact ? 'pt-1.5' : 'pt-2'">
      <div
        v-for="(option, index) in options"
        :key="index"
        class="flex cursor-pointer items-center hover:bg-muted/30"
        :class="compact ? 'gap-2 rounded-lg p-1.5' : 'gap-3 rounded-xl p-2'"
        @click="emit('resolve', 'approved', option)"
      >
        <div
          class="flex shrink-0 items-center justify-center rounded-sm bg-muted"
          :class="compact ? 'size-6' : 'size-7'"
        >
          <span class="font-medium text-muted-foreground" :class="compact ? 'text-xs' : 'text-sm'">
            {{ index + 1 }}
          </span>
        </div>
        <span class="break-words text-foreground" :class="compact ? 'text-sm' : 'text-base'">{{
          option
        }}</span>
      </div>
    </div>

    <!-- Footer / Custom Input -->
    <div class="flex w-full flex-row items-center" :class="compact ? 'gap-2 pt-1.5' : 'gap-3 pt-2'">
      <div
        class="flex flex-1 items-center border bg-muted/20"
        :class="compact ? 'gap-2 rounded-lg p-1.5' : 'gap-3 rounded-xl p-2'"
      >
        <div class="flex flex-1 items-center" :class="compact ? 'gap-2' : 'gap-3'">
          <div
            class="flex shrink-0 items-center justify-center rounded-sm bg-muted"
            :class="compact ? 'size-6' : 'size-7'"
          >
            <Pencil :class="compact ? 'size-3.5' : 'size-4'" class="text-muted-foreground" />
          </div>
          <input
            v-model="customText"
            class="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            :class="compact ? 'text-sm' : 'text-base'"
            placeholder="输入其他"
            @keydown.enter="handleKeydownEnter"
          />
        </div>
      </div>
      <div>
        <Button
          v-if="!customText.trim()"
          variant="outline"
          class="shrink-0"
          :class="compact ? 'h-7 rounded-lg px-3 text-xs' : 'rounded-[19px]'"
          @click="emit('resolve', 'rejected')"
        >
          跳过
        </Button>
        <Button
          v-else
          class="shrink-0"
          :class="compact ? 'h-7 rounded-lg px-3 text-xs' : 'rounded-[19px]'"
          @click="handleSubmit"
        >
          提交
        </Button>
      </div>
    </div>
  </div>
</template>
