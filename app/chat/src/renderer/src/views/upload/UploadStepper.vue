<script setup lang="ts">
import { Check, Circle, Dot } from 'lucide-vue-next'
import { Stepper, StepperIndicator, StepperItem, StepperSeparator, StepperTitle, StepperTrigger } from '@/components/ui/stepper'
import { computed } from 'vue'

// 双向绑定，使用方可以 v-model
const props = defineProps({
  modelValue: Number
});

const emit = defineEmits(['update:modelValue']);

const stepIndex = computed({
  get: () => props.modelValue || 1,
  set: (newValue) => {
    emit('update:modelValue', newValue)
  }
})

const steps = [
  {
    step: 1,
    title: '选择文件',
  },
  {
    step: 2,
    title: 'AI 解析',
  },
  {
    step: 3,
    title: '上传账单',
  },
]
</script>

<template>
  <Stepper class="flex w-full items-start gap-2" v-model="stepIndex">
    <StepperItem v-for="item in steps" :key="item.step" :step="item.step" v-slot="{ state }"
      class="relative flex w-full flex-col items-center justify-center">
      <StepperIndicator 
        class="
          bg-muted
          group-data-[state=completed]:bg-primary
          group-data-[state=completed]:text-primary-foreground
        ">
        <Check v-if="state === 'completed'" />
        <Circle v-if="state === 'active'" />
        <Dot v-if="state === 'inactive'" />
      </StepperIndicator>
      <StepperSeparator 
        v-if="item.step !== steps[steps.length - 1]?.step"
        class="absolute left-[calc(50%+20px)] right-[calc(-50%+10px)] top-5 block h-0.5 shrink-0 rounded-full bg-muted group-data-[state=completed]:bg-primary" />
      <div class="flex flex-col items-center">
        <StepperTitle>
          {{ item.title }}
        </StepperTitle>
      </div>
    </StepperItem>
  </Stepper>
</template>
