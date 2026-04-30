<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();
</script>

<template>
  <section
    class="rounded-[18px] border border-border bg-card p-6 shadow-[0_2px_8px_rgba(0,0,0,0.10)]"
  >
    <header class="border-b border-border pb-5">
      <h2 class="text-[22px] leading-none font-bold tracking-normal text-foreground">
        {{ title }}
      </h2>
      <p class="mt-3 text-base leading-6 font-semibold tracking-normal text-muted-foreground">
        {{ description }}
      </p>
    </header>

    <div class="pt-5">
      <slot />
    </div>
  </section>
</template>
