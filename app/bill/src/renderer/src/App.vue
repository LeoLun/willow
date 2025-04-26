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