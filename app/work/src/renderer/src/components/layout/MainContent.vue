<script setup lang="ts">
</script>

<template>
  <main class="flex h-full flex-col">
    <!-- Main content area -->
    <div class="flex-1 overflow-auto p-4">
      <slot>
        <div class="flex h-full items-center justify-center">
          <div class="text-center">
            <p class="text-lg font-medium text-muted-foreground">中间区域</p>
            <p class="mt-1 text-sm text-muted-foreground/60">在此处显示主要内容</p>
          </div>
        </div>
      </slot>
    </div>
  </main>
</template>
