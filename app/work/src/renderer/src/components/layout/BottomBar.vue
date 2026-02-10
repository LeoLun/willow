<script setup lang="ts">
</script>

<template>
  <footer class="flex h-6 shrink-0 items-center border-t border-border bg-background px-3">
    <slot>
      <div class="flex w-full items-center justify-between text-[11px] text-muted-foreground">
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1">
            设置
          </span>
        </div>
        <div class="flex items-center gap-3">
          <span class="size-2 rounded-full bg-emerald-500" />
          127.0.0.1:8000
        </div>
      </div>
    </slot>
  </footer>
</template>
