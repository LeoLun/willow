<script setup lang="ts">
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { ChevronDown, Circle, CircleCheck, CircleX, Clock3, Wrench } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import CodeBlock from "../components/CodeBlock.vue";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { i18n } from "../utils/i18n";
import { getToolSummary } from "./tool-summary";

const props = defineProps<{
  toolName?: string;
  params?: any;
  result?: ToolResultMessage;
  isStreaming?: boolean;
}>();

const open = ref(false);

const state = computed(() => {
  if (props.result) return props.result.isError ? "error" : "completed";
  return props.isStreaming ? "running" : "pending";
});

const paramsJson = computed(() => {
  if (!props.params) return "";
  try {
    return JSON.stringify(JSON.parse(props.params), null, 2);
  } catch {
    try {
      return JSON.stringify(props.params, null, 2);
    } catch {
      return String(props.params);
    }
  }
});

const outputData = computed(() => {
  if (!props.result) return null;
  let outputJson =
    props.result.content
      ?.filter((c) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n") || i18n("(no output)");
  let outputLanguage = "text";

  try {
    const parsed = JSON.parse(outputJson);
    outputJson = JSON.stringify(parsed, null, 2);
    outputLanguage = "json";
  } catch {
    // Not JSON
  }

  return { text: outputJson, language: outputLanguage };
});

const headerText = computed(() => {
  return props.toolName || props.result?.toolName || i18n("Tool Call");
});

const hasInputData = computed(
  () => !!(paramsJson.value && paramsJson.value !== "{}" && paramsJson.value !== "null"),
);

const hasOutputData = computed(() => !!outputData.value);

const hasDetails = computed(() => hasInputData.value || hasOutputData.value);

const isInProgress = computed(() => state.value === "running");

const shouldShowDetails = computed(() => hasDetails.value && !isInProgress.value && open.value);

const summaryText = computed(() =>
  getToolSummary(
    props.toolName || props.result?.toolName,
    props.params,
    props.result?.details,
    isInProgress.value,
  ),
);

const statusConfig = computed(() => {
  if (state.value === "pending") {
    return {
      text: i18n("Pending"),
      icon: Circle,
      badgeClass: "bg-muted text-foreground",
      iconClass: "text-foreground",
    };
  }
  if (state.value === "running") {
    return {
      text: i18n("Running"),
      icon: Clock3,
      badgeClass: "bg-muted text-foreground",
      iconClass: "text-muted-foreground",
    };
  }
  if (state.value === "error") {
    return {
      text: i18n("Error"),
      icon: CircleX,
      badgeClass: "bg-muted text-foreground",
      iconClass: "text-destructive",
    };
  }
  return {
    text: i18n("Completed"),
    icon: CircleCheck,
    badgeClass: "bg-muted text-foreground",
    iconClass: "text-green-600 dark:text-green-500",
  };
});

watch(
  isInProgress,
  (running) => {
    if (running) {
      open.value = false;
    }
  },
  { immediate: true },
);

function handleOpenChange(nextOpen: boolean) {
  if (!hasDetails.value || isInProgress.value) {
    open.value = false;
    return;
  }
  open.value = nextOpen;
}
</script>

<template>
  <Collapsible :open="open" @update:open="handleOpenChange">
    <div class="rounded-lg border border-border bg-card px-3 py-1.5 text-card-foreground">
      <CollapsibleTrigger
        class="flex w-full items-center justify-between gap-3 text-left disabled:pointer-events-none"
        :disabled="!hasDetails || isInProgress"
      >
        <div class="flex min-w-0 items-center gap-3">
          <Wrench class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span class="truncate text-xs leading-none text-muted-foreground">{{ summaryText }}</span>
          <span
            class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs leading-none"
            :class="statusConfig.badgeClass"
          >
            <component
              :is="statusConfig.icon"
              class="h-3.5 w-3.5"
              :class="statusConfig.iconClass"
            />
            {{ statusConfig.text }}
          </span>
        </div>
        <ChevronDown
          class="h-5 w-5 shrink-0 text-muted-foreground transition-transform"
          :class="{ 'rotate-180': shouldShowDetails }"
        />
      </CollapsibleTrigger>

      <!-- <div v-if="summaryText" class="mt-3 text-sm text-muted-foreground">
        {{ summaryText }}
      </div> -->

      <CollapsibleContent v-if="hasDetails" class="CollapsibleContent mt-6">
        <template v-if="result">
          <div v-if="hasInputData" class="space-y-2">
            <div class="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              {{ i18n("Parameters") }}
            </div>
            <div class="rounded-xl border border-border p-3">
              <CodeBlock :code="paramsJson" language="json" />
            </div>
          </div>
          <div v-if="hasOutputData" class="mt-4 space-y-2">
            <div class="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              {{ i18n("Result") }}
            </div>
            <div class="rounded-xl border border-border p-3">
              <CodeBlock :code="outputData!.text" :language="outputData!.language" />
            </div>
          </div>
        </template>
        <template v-else-if="hasInputData">
          <div class="space-y-2">
            <div class="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              {{ i18n("Parameters") }}
            </div>
            <div class="rounded-xl border border-border p-3">
              <CodeBlock :code="paramsJson" language="json" />
            </div>
          </div>
        </template>
      </CollapsibleContent>
    </div>
  </Collapsible>
</template>
