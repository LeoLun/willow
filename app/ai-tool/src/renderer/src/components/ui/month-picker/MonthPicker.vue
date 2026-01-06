<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type Props = {
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '选择月份',
  disabled: false,
})

const emits = defineEmits<{
  (e: 'update:modelValue', payload: string): void
}>()

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function parseMonth(v: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(v)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (!Number.isFinite(year) || month < 1 || month > 12) return null
  return { year, month }
}

function formatMonth(year: number, month: number) {
  return `${year}-${pad2(month)}`
}

const open = ref(false)
const viewYear = ref<number>(new Date().getFullYear())

const selected = computed(() => parseMonth(props.modelValue))

watch(
  selected,
  (v) => {
    if (v?.year) viewYear.value = v.year
  },
  { immediate: true },
)

const displayText = computed(() => {
  if (selected.value) return `${selected.value.year}-${pad2(selected.value.month)}`
  return props.placeholder
})

const months = [
  { month: 1, label: '1月' },
  { month: 2, label: '2月' },
  { month: 3, label: '3月' },
  { month: 4, label: '4月' },
  { month: 5, label: '5月' },
  { month: 6, label: '6月' },
  { month: 7, label: '7月' },
  { month: 8, label: '8月' },
  { month: 9, label: '9月' },
  { month: 10, label: '10月' },
  { month: 11, label: '11月' },
  { month: 12, label: '12月' },
]

const now = computed(() => {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
})

function isDisabled(year: number, month: number) {
  // 禁止选择“本月及之后”的月份
  if (year > now.value.year) return true
  if (year < now.value.year) return false
  return month >= now.value.month
}

const pick = (m: number) => {
  if (isDisabled(viewYear.value, m)) return
  emits('update:modelValue', formatMonth(viewYear.value, m))
  open.value = false
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        class="w-[160px] justify-start font-normal"
        :class="cn(!selected ? 'text-muted-foreground' : '', props.class)"
        :disabled="disabled"
      >
        <Calendar class="mr-2 h-4 w-4" />
        {{ displayText }}
      </Button>
    </PopoverTrigger>

    <PopoverContent class="w-[280px] p-3">
      <div class="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          @click="viewYear -= 1"
        >
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <div class="text-sm font-medium tabular-nums">
          {{ viewYear }} 年
        </div>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          @click="viewYear += 1"
        >
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>

      <div class="mt-3 grid grid-cols-3 gap-2">
        <button
          v-for="m in months"
          :key="m.month"
          type="button"
          class="inline-flex h-9 items-center justify-center rounded-md border text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          :class="
            isDisabled(viewYear, m.month)
              ? 'opacity-50 cursor-not-allowed hover:bg-background hover:text-foreground'
              : selected?.year === viewYear && selected?.month === m.month
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background'
          "
          :disabled="isDisabled(viewYear, m.month)"
          @click="pick(m.month)"
        >
          {{ m.label }}
        </button>
      </div>
    </PopoverContent>
  </Popover>
</template>


