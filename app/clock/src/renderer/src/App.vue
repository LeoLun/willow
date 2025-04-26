<template>
  <div class="root">
    <Time />
    <WeatherNow class="weather-now"/>
    <Weather class="waather-fc"/>
  </div>
</template>

<script setup lang="ts">
import Time from './components/Time.vue';
import Weather from './components/Weather.vue';
import WeatherNow from './components/WeatherNow.vue';
</script>

<style scoped>
.root {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  height: 100vh;
  width: 100vw;
  background-color: #000;
  padding-top: 15%;
}

.waather-fc {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  bottom: 8%;
}

.weather-now {
  margin-top: 2vmin;
}
</style>