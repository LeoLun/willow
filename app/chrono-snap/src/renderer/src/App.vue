<script setup lang=ts>
import { watch } from 'vue';
import TopDragBar from './components/base/TopDragBar.vue';
import { useColorMode } from '@vueuse/core'

const mode = useColorMode()
watch(mode, (value) => {
  document.documentElement.classList.remove('dark', 'light')
  document.documentElement.classList.add(value)
}, { immediate: true })
</script>

<template>
  <TopDragBar />
  <router-view />
</template>
<style lang="css">
:root {
  --scrollbar-color: #0000001a;
}

*,
::backdrop,
:after,
:before {
  border: 0 solid;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.overflow-auto,
.overflow-scroll,
.overflow-x-auto,
.overflow-x-scroll,
.overflow-y-auto,
.overflow-y-scroll {
  scrollbar-color: var(--scrollbar-color) transparent;
}
</style>