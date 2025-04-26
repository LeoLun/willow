<template>
  <div class="weather-now">
    <span style="font-size: 9vmin;">{{ degree }}°</span>
    <span style="font-size: 5vmin;">{{ weather }}</span>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { electronAPI } from '../lib/ipc'
import { TimeService } from '../services/time-services';

const degree = ref('')
const weather = ref('')

const init  = async () => {
  const {observe} = await electronAPI.fetchWeatherNow()
  degree.value = observe?.degree
  weather.value = observe?.weather
}

onMounted(async () => {
  init()
  TimeService.onQuarterChange(async () => {
    await init()
  })
})
</script>

<style scoped>
.weather-now {
  margin-top: 2vmin 0;
  vertical-align: bottom;
  font-size: 0;
  background: linear-gradient(to right, #00c9a7 0%, #845ec2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>