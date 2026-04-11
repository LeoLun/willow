<template>
  <div class="flex w-full flex-col items-center">
    <div class="drag-region h-2 w-full"></div>
    <div class="flex h-8 w-full items-center gap-1 px-2 pb-2">
      <slot />
      <div class="drag-region flex-1"></div>
      <slot name="extra" />
    </div>
  </div>
</template>

<script setup lang="ts"></script>
