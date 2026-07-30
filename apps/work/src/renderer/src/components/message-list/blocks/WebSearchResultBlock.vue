<script setup lang="ts">
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@willow/shadcn/components/ui/collapsible";
import { GlobeIcon, SearchIcon } from "lucide-vue-next";
import { computed, ref, shallowRef } from "vue";
import {
  formatToolCallTitle,
  getSafeExternalUrl,
  getSafeFaviconUrl,
  getWebSearchDetails,
} from "../tool-display";
import type { Message, ToolCallContent } from "../types";
import ContentBlocks from "./ContentBlocks.vue";

const props = defineProps<{
  toolCall?: ToolCallContent;
  result?: Message;
}>();

const open = ref(false);
const failedFavicons = shallowRef<ReadonlySet<string>>(new Set());
const details = computed(() => getWebSearchDetails(props.result?.details));
const summary = computed(() =>
  props.toolCall
    ? formatToolCallTitle(props.toolCall.name, props.toolCall.arguments)
    : details.value
      ? `搜索 ${details.value.query}`
      : "网络搜索",
);
const status = computed(() => {
  if (!props.result) return "搜索中…";
  return props.result.isError ? "搜索失败" : "搜索完成";
});

function resultKey(url: string, index: number): string {
  return `${index}:${url}`;
}

function markFaviconFailed(key: string): void {
  failedFavicons.value = new Set([...failedFavicons.value, key]);
}
</script>

<template>
  <Collapsible
    v-model:open="open"
    data-content-type="toolResult"
    data-tool-name="websearch"
    data-slot="websearch-result-block"
  >
    <CollapsibleTrigger as-child>
      <button
        type="button"
        class="flex w-full items-center gap-1 text-left text-muted-foreground disabled:cursor-default"
        :class="props.result ? 'cursor-pointer' : ''"
        :disabled="!props.result"
        :aria-label="`${summary}，${status}${props.result ? `，${open ? '收起' : '展开'}搜索结果` : ''}`"
      >
        <SearchIcon
          class="size-4 shrink-0"
          :class="props.result?.isError ? 'text-destructive' : ''"
          aria-hidden="true"
        />
        <span class="min-w-0 truncate">{{ summary }}</span>
        <span
          class="shrink-0"
          :class="props.result?.isError ? 'text-destructive' : 'text-muted-foreground/70'"
        >
          {{ status }}
        </span>
      </button>
    </CollapsibleTrigger>

    <CollapsibleContent
      class="mt-2 flex max-h-[145px] flex-col gap-2 overflow-y-auto rounded-lg border bg-sidebar-foreground/5 px-3 py-1 text-sm text-muted-foreground"
    >
      <div
        v-if="props.result?.isError"
        class="rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive"
      >
        <ContentBlocks :message="props.result" />
      </div>
      <div v-else-if="details?.results.length" class="" data-slot="websearch-results">
        <component
          :is="getSafeExternalUrl(item.url) ? 'a' : 'div'"
          v-for="(item, index) in details.results"
          :key="resultKey(item.url, index)"
          :href="getSafeExternalUrl(item.url)"
          :target="getSafeExternalUrl(item.url) ? '_blank' : undefined"
          :rel="getSafeExternalUrl(item.url) ? 'noreferrer noopener' : undefined"
          class="flex min-h-7 items-center gap-3 rounded-lg text-xs text-muted-foreground"
        >
          <img
            v-if="
              getSafeFaviconUrl(item.favicon) && !failedFavicons.has(resultKey(item.url, index))
            "
            :src="getSafeFaviconUrl(item.favicon)"
            alt=""
            class="size-3 shrink-0 rounded-sm object-contain"
            @error="markFaviconFailed(resultKey(item.url, index))"
          />
          <GlobeIcon v-else class="size-4 shrink-0" aria-hidden="true" />
          <span class="min-w-0 truncate">{{ item.title }}</span>
        </component>
      </div>
      <p v-else class="px-2 py-3 text-sm text-muted-foreground">未找到搜索结果。</p>
    </CollapsibleContent>
  </Collapsible>
</template>
