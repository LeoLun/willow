<script setup lang="ts">
import {
  PopoverRoot,
  type PopoverRootEmits,
  type PopoverRootProps,
  useForwardPropsEmits,
} from 'radix-vue'
import { computed } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<PopoverRootProps>()
const emits = defineEmits<PopoverRootEmits>()

const forwarded = useForwardPropsEmits(computed(() => props), emits)
</script>

<template>
  <PopoverRoot v-bind="{ ...forwarded, ...$attrs }">
    <slot />
  </PopoverRoot>
</template>


