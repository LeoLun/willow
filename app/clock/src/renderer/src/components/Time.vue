<template>
  <div class="clock-container" @click="toggleFullScreen">
    <span class="clock">{{ hours }}</span>
    <span class="second"></span>
    <span class="clock">{{ minutes }}</span>
    <div class="day">{{ dayString }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { TimeService } from '../services/time-services';

const hours = ref('');
const minutes = ref('');
const dayString = ref('');

const dayNames = ['日','一','二','三','四','五','六'];

const updateTime = () => {
  const now = new Date();
  hours.value = String(now.getHours()).padStart(2, '0');
  minutes.value = String(now.getMinutes()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  dayString.value = `星期${dayNames[now.getDay()]} ${month}/${date}`;
};

onMounted(() => {
  updateTime();
  TimeService.onSecondChange(() => {
    updateTime();
  });
});

const toggleFullScreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
};
</script>

<style scoped>
.clock-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  background: linear-gradient(to right, #00c9a7 0%, #845ec2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-family: 'Roboto', sans-serif;
}

.clock {
  font-size: 25vmin;
  line-height: 25vmin;
}

.day {
  margin-top: 20px;
  font-size: 4vmin;
  line-height: 4vmin;
}

.second {
  height: 20px;
  width: 100%;
  border-radius: 20px;
  background: linear-gradient(to right, #00c9a7 0%, #845ec2 100%);
  animation: secondAnim 2s ease-in-out infinite alternate;
}

@keyframes secondAnim {
  0% {
    width: 100%;
  }
  50% {
    width: 20px;
  }
  100% {
    width: 100%;
  }
}
</style>