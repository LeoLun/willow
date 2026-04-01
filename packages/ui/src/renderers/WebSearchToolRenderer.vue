<script setup lang="ts">
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { ChevronDown, ExternalLink, Globe, Search } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import CodeBlock from "../components/CodeBlock.vue";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { i18n } from "../utils/i18n";

interface WebSearchResultItem {
  title: string;
  url: string;
}

interface WebSearchDetails {
  query?: string;
  searchDepth?: "basic" | "advanced";
  numResults?: number;
  resultCount?: number;
  hasAnswer?: boolean;
  results?: WebSearchResultItem[];
}

const props = defineProps<{
  params?: any;
  result?: ToolResultMessage<WebSearchDetails>;
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

const details = computed<WebSearchDetails>(() => props.result?.details ?? {});

const state = computed(() => {
  if (props.result) return props.result.isError ? "error" : "completed";
  return props.isStreaming ? "running" : "pending";
});

const hasResultError = computed(() => !!props.result?.isError);

const queryText = computed(() => details.value.query || parsedParams.value.query || "");

const headerLabel = computed(() => {
  if (!queryText.value) return i18n("web_searching");
  return `${i18n("web_search")} "${queryText.value}"`;
});

const MAX_VISIBLE_RESULTS = 4;
const resultItems = computed<WebSearchResultItem[]>(() => details.value.results ?? []);
const visibleResults = computed(() => resultItems.value.slice(0, MAX_VISIBLE_RESULTS));
const overflowCount = computed(() => Math.max(0, resultItems.value.length - MAX_VISIBLE_RESULTS));

function summarizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch {
    return url;
  }
}

const outputText = computed(() => {
  if (!props.result) return "";
  return (
    props.result.content
      ?.filter((item) => item.type === "text")
      .map((item: any) => item.text)
      .join("\n") ?? ""
  );
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
        <div class="min-w-0 flex-1 space-y-2">
          <div class="flex items-center gap-2">
            <Search class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div class="truncate text-xs leading-none text-muted-foreground">{{ headerLabel }}</div>
            <span
              class="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs leading-none text-muted-foreground"
            >
              {{
                state === "running"
                  ? i18n("web_searching")
                  : hasResultError
                    ? i18n("Error")
                    : i18n("Completed")
              }}
            </span>
          </div>

          <div v-if="resultItems.length > 0" class="flex items-center gap-1.5 overflow-hidden">
            <a
              v-for="(item, idx) in visibleResults"
              :key="idx"
              :href="item.url"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
              @click.stop
            >
              <Globe class="h-3 w-3 shrink-0" />
              <span class="max-w-[140px] truncate">{{ summarizeUrl(item.url) }}</span>
            </a>
            <span
              v-if="overflowCount > 0"
              class="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              +{{ overflowCount }}
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
            <CodeBlock :code="outputText" language="markdown" />
          </div>
        </div>
      </CollapsibleContent>
    </div>
  </Collapsible>
</template>
