<script setup lang="ts">
import { useIntersectionObserver } from "@vueuse/core";
import { useTemplateRef } from "vue";

const props = defineProps<{
  disabled?: boolean;
  label?: string;
}>();

const emit = defineEmits<{
  visible: [];
}>();

const sentinel = useTemplateRef<HTMLElement>("sentinel");

useIntersectionObserver(
  sentinel,
  ([entry]) => {
    if (entry?.isIntersecting && !props.disabled) emit("visible");
  },
  { rootMargin: "96px 0px" },
);
</script>

<template>
  <div
    ref="sentinel"
    class="flex h-8 items-center text-xs text-muted-foreground"
    data-slot="file-tree-load-more"
    role="status"
  >
    {{ label ?? (disabled ? "正在加载更多…" : "继续加载…") }}
  </div>
</template>
