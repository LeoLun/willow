<!-- TODO: 待 arkUser 工具实现后接入实际审批逻辑 -->
<script setup lang="ts">
import { Button } from "@willow/shadcn";
import { X } from "lucide-vue-next";

const emit = defineEmits<{
  skip: [];
  close: [];
}>();
</script>

<template>
  <div
    class="w-full rounded-[24px] border bg-background px-[28px] py-[22px]"
    style="box-shadow: 0 10px 28px rgba(0, 0, 0, 0.078)"
  >
    <!-- Header -->
    <div class="flex w-full items-center justify-between gap-4">
      <div class="min-w-0 flex-1 text-base leading-[1.45] font-semibold text-foreground">
        arkUser 工具审批（待实现）
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        class="size-[18px] text-muted-foreground hover:text-foreground"
        @click="emit('close')"
      >
        <X class="size-[18px]" />
      </Button>
    </div>

    <!-- Choice List -->
    <div class="flex w-full flex-col pt-[22px]">
      <div class="flex h-16 items-center gap-[14px]">
        <div class="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-muted">
          <span class="text-[13px] font-medium text-muted-foreground">1</span>
        </div>
        <div class="min-w-0 flex-1">
          <span class="text-[15px] text-muted-foreground"> TODO: 待 arkUser 工具实现后接入 </span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex w-full items-center gap-3 pt-[10px]">
      <div class="flex flex-1 items-center gap-3">
        <div class="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-muted">
          <span class="text-[13px] font-medium text-muted-foreground">…</span>
        </div>
        <span class="text-[15px] text-muted-foreground">待实现</span>
      </div>

      <Button
        variant="outline"
        class="h-[38px] w-[86px] shrink-0 rounded-[19px] text-[15px] font-semibold"
        @click="emit('skip')"
      >
        跳过
      </Button>
    </div>
  </div>
</template>
