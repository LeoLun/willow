<script setup lang="ts">
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { FileText, Globe, List, Search } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import CodeBlock from "../components/CodeBlock.vue";
import ToolCallCard from "../components/ToolCallCard.vue";
import ToolCallDetailRow from "../components/ToolCallDetailRow.vue";
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
  onOpenUrl?: (url: string) => void | Promise<void>;
}>();

const resultListRef = ref<HTMLElement | null>(null);
const resultListWidth = ref(0);

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

const stateLabel = computed(() => {
  if (state.value === "error") return i18n("Error");
  if (state.value === "running") return i18n("Running");
  if (state.value === "pending") return i18n("Pending");
  return i18n("Completed");
});

const queryText = computed(() => details.value.query || parsedParams.value.query || "");

const titleText = computed(() => {
  if (!queryText.value) return i18n("web_searching");
  return `${i18n("web_search")} ${queryText.value}`;
});

const resultItems = computed<WebSearchResultItem[]>(() => details.value.results ?? []);
const resultCount = computed(
  () => details.value.resultCount ?? details.value.numResults ?? resultItems.value.length,
);

function summarizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch {
    return url;
  }
}

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
  () => {
    updateResultListWidth();
  },
);

function updateResultListWidth() {
  resultListWidth.value = resultListRef.value?.clientWidth ?? 0;
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  updateResultListWidth();

  if (!resultListRef.value || typeof ResizeObserver === "undefined") {
    return;
  }

  resizeObserver = new ResizeObserver(() => {
    updateResultListWidth();
  });
  resizeObserver.observe(resultListRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<template>
  <ToolCallCard
    :title="titleText"
    :can-expand="canExpand"
    :error="state === 'error'"
    :loading="state === 'running' || state === 'pending'"
  >
    <template #icon>
      <Search class="size-3.5 shrink-0 text-muted-foreground" />
    </template>

    <template #details>
      <div ref="resultListRef" class="flex min-w-0 flex-col items-center gap-1.5 overflow-hidden">
        <div
          v-for="(item, idx) in resultItems"
          :key="idx"
          target="_blank"
          rel="noopener noreferrer"
          class="flex w-full min-w-0 shrink-0 flex-col items-start gap-1 rounded-md bg-muted/50 px-2 py-1 text-muted-foreground hover:bg-muted"
          :class="{ 'cursor-pointer': onOpenUrl }"
          @click.stop="onOpenUrl && onOpenUrl(item.url)"
        >
          <div class="flex h-5 items-center gap-1 text-xs">
            <Globe class="size-3 shrink-0" />
            <span class="truncate">{{ item.url }}</span>
          </div>
          <div
            class="max-w-full truncate overflow-hidden text-sm text-ellipsis text-muted-foreground"
          >
            {{ item.title }}
          </div>
        </div>
      </div>
    </template>
  </ToolCallCard>
</template>
