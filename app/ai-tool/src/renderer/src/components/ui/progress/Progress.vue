<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    value?: number
    max?: number
    class?: HTMLAttributes['class']
  }>(),
  {
    value: 0,
    max: 100,
  },
)

const percent = () => {
  const max = props.max || 0
  if (max <= 0) return 0
  const v = Math.max(0, Math.min(props.value ?? 0, max))
  return (v / max) * 100
}
</script>

<template>
  <div
    role="progressbar"
    :aria-valuenow="props.value"
    :aria-valuemin="0"
    :aria-valuemax="props.max"
    :class="cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', props.class)"
  >
    <div
      class="h-full w-full flex-1 bg-primary transition-transform"
      :style="{ transform: `translateX(-${100 - percent()}%)` }"
    />
  </div>
</template>


