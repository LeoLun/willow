<template>
  <div class="weather-card">
    <div class="weather-card__date">{{ forecast.time.substring(5) }}</div>
    <div class="weather-card__weather">{{ forecast.day_weather_short }}</div>
    <img class="weather-card__icon" :src="forecastDayImg" alt="weather" />
    <div class="weather-card__degree"></div>
    <img class="weather-card__icon" :src="forecastNightImg" alt="weather" />
    <div class="weather-card__weather">{{ forecast.night_weather_short }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { IForecast } from '../../../shared/type/weather';

const props = defineProps<{
  forecast: IForecast
}>();

const forecast = computed(() => props.forecast);

const forecastDayImg = computed(() => {
  return `http://mat1.gtimg.com/pingjs/ext2020/weather/pc/icon/weather/day/${props.forecast.day_weather_code}.png`;
});

const forecastNightImg = computed(() => {
  return `http://mat1.gtimg.com/pingjs/ext2020/weather/pc/icon/weather/night/${props.forecast.day_weather_code}.png`;
});
</script>

<style scoped>
.weather-card {
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  flex: 1;
}

.weather-card__date {
  font-size: 2vmin;
  color: #FFF;
  margin-bottom: 1.5vmin;
  height: 2vmin;
  line-height: 2vmin;
}

.weather-card__weather {
  font-size: 2vmin;
  color: #FFF;
  line-height: 2vmin;
  height: 2vmin;
  margin: 1vmin 0;
}

.weather-card__icon {
  display: inline-block;
  height: 5vmin;
  width: 5vmin;
}

.weather-card__degree {
  height: 15vh;
}
</style>