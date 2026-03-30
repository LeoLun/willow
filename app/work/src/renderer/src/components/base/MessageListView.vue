<script setup lang="ts">
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { MessageList } from "@mariozechner/pi-web-ui";
import { ref, onMounted, onUnmounted, watch } from "vue";
import piWebUiCss from "@mariozechner/pi-web-ui/app.css?inline";

const props = defineProps<{
  messages: AgentMessage[];
  tools: any[];
  isStreaming: boolean;
  pendingToolCalls: Set<string>;
}>();

const host = ref<HTMLElement>();
let shadow: ShadowRoot;
let el: MessageList;

function syncAll() {
  if (!el) return;
  el.messages = props.messages;
  el.tools = props.tools;
  el.isStreaming = props.isStreaming;
  el.pendingToolCalls = props.pendingToolCalls;
}

onMounted(() => {
  shadow = host.value!.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = piWebUiCss;

  style.textContent += `
    .user-message-container {
      margin-left: auto;
    }
  `;
  shadow.appendChild(style);

  el = document.createElement("message-list") as MessageList;
  syncAll();
  shadow.appendChild(el);
});

watch(
  () => props.messages,
  (v) => {
    if (el) el.messages = v;
  },
  { deep: true },
);
watch(
  () => props.tools,
  (v) => {
    if (el) el.tools = v;
  },
);
watch(
  () => props.isStreaming,
  (v) => {
    if (el) el.isStreaming = v;
  },
);
watch(
  () => props.pendingToolCalls,
  (v) => {
    if (el) el.pendingToolCalls = v;
  },
);

onUnmounted(() => {
  el?.remove();
});
</script>

<template>
  <div ref="host" />
</template>
