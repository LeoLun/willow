<script setup lang="ts">
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { CircleCheck, CircleX, FileText, Globe } from "lucide-vue-next";
import { computed } from "vue";
import CodeBlock from "../components/CodeBlock.vue";
import ToolCallCard from "../components/ToolCallCard.vue";
import ToolCallDetailRow from "../components/ToolCallDetailRow.vue";
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

const stateLabel = computed(() => {
  if (state.value === "error") return i18n("Error");
  if (state.value === "running") return i18n("Running");
  if (state.value === "pending") return i18n("Pending");
  return i18n("Completed");
});

const requestUrl = computed(() => details.value.url || parsedParams.value.url || "");

const targetLabel = computed(() => {
  if (!requestUrl.value) return i18n("fetch_web");
  try {
    const url = new URL(requestUrl.value);
    return `${url.host}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return requestUrl.value;
  }
});

const titleText = computed(() => {
  if (!requestUrl.value) return i18n("fetch_web");
  return `读取 ${targetLabel.value}`;
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

const previewLabel = computed(() => {
  if (outputLanguage.value === "html") return "HTML 内容预览";
  if (outputLanguage.value === "markdown") return "Markdown 内容预览";
  return "文本内容预览";
});

const statusDetailText = computed(() => {
  if (state.value === "error") return "抓取失败";
  if (state.value === "running") return "抓取中";
  if (state.value === "pending") return "等待抓取";
  return "抓取完成";
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
</script>

<template>
  <ToolCallCard
    :title="titleText"
    :state-label="stateLabel"
    :can-expand="false"
    :error="state === 'error'"
    :loading="state === 'running' || state === 'pending'"
  >
    <template #icon>
      <Globe class="size-3.5 shrink-0 text-muted-foreground" />
    </template>
  </ToolCallCard>
</template>
