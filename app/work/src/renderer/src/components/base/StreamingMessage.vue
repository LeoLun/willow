<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import type { StreamingMessageContainer } from "@mariozechner/pi-web-ui";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import piWebUiCss from "@mariozechner/pi-web-ui/app.css?inline";

const props = defineProps<{
  message: AgentMessage | null;
  isStreaming: boolean;
  tools: any[];
  pendingToolCalls: Set<string>;
}>();

const host = ref<HTMLElement>();
let shadow: ShadowRoot;
let el: StreamingMessageContainer;

onMounted(() => {
  shadow = host.value!.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = piWebUiCss;
  shadow.appendChild(style);

  el = document.createElement(
    "streaming-message-container",
  ) as StreamingMessageContainer;
  el.isStreaming = props.isStreaming;
  el.tools = props.tools;
  el.pendingToolCalls = props.pendingToolCalls;
  if (props.message) {
    el.setMessage(props.message, !props.isStreaming);
  }
  shadow.appendChild(el);
});

watch(
  () => props.message,
  (v) => {
    if (!el) return;
    el.setMessage(v, !props.isStreaming);
  },
);

watch(() => props.isStreaming, (v) => { if (el) el.isStreaming = v; });
watch(() => props.tools, (v) => { if (el) el.tools = v; });
watch(() => props.pendingToolCalls, (v) => { if (el) el.pendingToolCalls = v; });

onUnmounted(() => {
  el?.remove();
});
</script>

<template>
  <div ref="host" />
</template>
