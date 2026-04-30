<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();
</script>

<template>
  <article
    class="rounded-[16px] border border-border bg-card p-[18px] shadow-[0_2px_6px_rgba(0,0,0,0.08)]"
  >
    <header>
      <h3 class="text-lg leading-none font-bold tracking-normal text-foreground">
        {{ title }}
      </h3>
      <p class="mt-2.5 text-[15px] leading-5 font-semibold tracking-normal text-muted-foreground">
        {{ description }}
      </p>
    </header>

    <div class="mt-3.5">
      <slot />
    </div>
  </article>
</template>
