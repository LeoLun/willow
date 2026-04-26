<script setup lang="ts">
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@willow/shadcn";
import { ChevronDown, Clock3, Globe, RotateCcw } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import CodeBlock from "../components/CodeBlock.vue";
import { i18n } from "../utils/i18n";

interface WebFetchDetails {
  url?: string;
  format?: "text" | "markdown" | "html";
  timeoutMs?: number;
  contentType?: string;
  title?: string;
  outputLength?: number;
  fetchStatus?: number;
  wasRetried?: boolean;
  returnedFormat?: "text" | "markdown" | "html";
}

const props = defineProps<{
  params?: any;
  result?: ToolResultMessage<WebFetchDetails>;
  isStreaming?: boolean;
}>();

const open = ref(false);

const parsedParams = computed<Record<string, any>>(() => {
  if (!props.params) return {};
  if (typeof props.params === "object") return props.params;
  if (typeof props.params === "string") {
    try {
      return JSON.parse(props.params) as Record<string, any>;
    } catch {
      return {};
    }
  }
  return {};
});

const details = computed<WebFetchDetails>(() => props.result?.details ?? {});

const state = computed(() => {
  if (props.result) return props.result.isError ? "error" : "completed";
  return props.isStreaming ? "running" : "pending";
});

const hasResultError = computed(() => !!props.result?.isError);

const requestUrl = computed(() => details.value.url || parsedParams.value.url || "");

const hostLabel = computed(() => {
  if (!requestUrl.value) return i18n("fetch_web");
  try {
    const url = new URL(requestUrl.value);
    return `${i18n("read_web")} ${url.host}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return requestUrl.value;
  }
});

const outputText = computed(() => {
  if (!props.result) return "";
  return (
    props.result.content
      ?.filter((item) => item.type === "text")
      .map((item: any) => item.text)
      .join("\n") ?? ""
  );
});

const previewText = computed(() => {
  if (!outputText.value) return "";
  return outputText.value.length > 1200
    ? `${outputText.value.slice(0, 1200)}\n\n...[已截断预览]`
    : outputText.value;
});

const outputLanguage = computed(() => {
  const format = details.value.returnedFormat || parsedParams.value.format || "markdown";
  if (format === "html") return "html";
  if (format === "markdown") return "markdown";
  return "text";
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

const hasDetails = computed(() => !!props.result || !!paramsJson.value);
const canExpand = computed(() => hasDetails.value && state.value !== "running");

watch(
  () => state.value,
  (value) => {
    if (value === "running") {
      open.value = false;
    }
  },
  { immediate: true },
);

function handleOpenChange(nextOpen: boolean) {
  if (!canExpand.value) {
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
        :disabled="!canExpand"
      >
        <div class="min-w-0 flex-1 space-y-3">
          <div class="flex min-w-0 items-center gap-2">
            <Globe class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div class="min-w-0 flex-1 truncate text-xs leading-none text-muted-foreground">
              {{ hostLabel }}
            </div>
            <span
              class="inline-flex shrink-0 items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs leading-none whitespace-nowrap text-muted-foreground"
            >
              {{
                state === "running"
                  ? i18n("fetch_web")
                  : hasResultError
                    ? i18n("Error")
                    : i18n("Completed")
              }}
            </span>
          </div>
        </div>

        <ChevronDown
          class="h-5 w-5 shrink-0 text-muted-foreground transition-transform"
          :class="{ 'rotate-180': open }"
        />
      </CollapsibleTrigger>

      <CollapsibleContent v-if="hasDetails" class="CollapsibleContent mt-4 space-y-4">
        <div v-if="paramsJson" class="space-y-2">
          <div class="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {{ i18n("parameters") }}
          </div>
          <div class="rounded-xl border border-border p-3">
            <CodeBlock :code="paramsJson" language="json" />
          </div>
        </div>

        <div v-if="outputText" class="space-y-2">
          <div class="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {{ i18n("Result") }}
          </div>
          <div class="rounded-xl border border-border p-3">
            <CodeBlock :code="outputText" :language="outputLanguage" />
          </div>
        </div>
      </CollapsibleContent>
    </div>
  </Collapsible>
</template>
