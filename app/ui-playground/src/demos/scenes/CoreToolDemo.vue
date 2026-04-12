<script setup lang="ts">
import CoreToolRenderer from "@willow/ui/renderers/CoreToolRenderer.vue";
import { coreToolParams, coreToolResult } from "../mock-data";
</script>

<template>
  <div class="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
    <div>
      <h3 class="text-sm font-semibold text-foreground">Core Renderer</h3>
      <p class="mt-1 text-sm text-muted-foreground">检查通用工具头部、展开详情和 JSON 输出。</p>
    </div>
    <CoreToolRenderer tool-name="finance" :params="coreToolParams" :result="coreToolResult" />
  </div>
</template>
