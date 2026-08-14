<script setup lang="ts">
import type { TurnArtifactBundle } from "@shared/api";
import FileArtifactCard from "./FileArtifactCard.vue";
import PlanArtifactCard from "./PlanArtifactCard.vue";

const props = defineProps<{
  artifact: TurnArtifactBundle;
}>();
</script>

<template>
  <div class="flex flex-col gap-3" data-slot="artifact-area">
    <FileArtifactCard v-if="props.artifact.files.length > 0" :files="props.artifact.files" />
    <PlanArtifactCard v-for="plan in props.artifact.plans" :key="plan.path" :plan="plan" />
  </div>
</template>
