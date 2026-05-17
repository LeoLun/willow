<script setup>
import { ref, reactive, onMounted, watch, onUnmounted } from "vue";

const props = defineProps({ streaming: Boolean });

const config = reactive({
  name: "Six-Petal Spiral",
  tag: "R = 6, r = 1, d = 3",
  rotate: true,
  particleCount: 50,
  trailSpan: 0.34,
  durationMs: 6000,
  rotationDurationMs: 28000,
  pulseDurationMs: 4200,
  strokeWidth: 4.4,
  spiralR: 6,
  spiralr: 1,
  spirald: 3,
  spiralScale: 4.5,
  spiralBreath: 0.45,
});

const rotation = ref(0);
const pathData = ref("");
const particleStyles = ref([]);
let rafId = null;
let running = false;

const getPoint = (progress, detailScale) => {
  const t = progress * Math.PI * 2;
  const d = config.spirald + detailScale * 0.25;
  const baseX =
    (config.spiralR - config.spiralr) * Math.cos(t) +
    d * Math.cos(((config.spiralR - config.spiralr) / config.spiralr) * t);
  const baseY =
    (config.spiralR - config.spiralr) * Math.sin(t) -
    d * Math.sin(((config.spiralR - config.spiralr) / config.spiralr) * t);
  const scale = config.spiralScale + detailScale * config.spiralBreath;
  return { x: 50 + baseX * scale, y: 50 + baseY * scale };
};

const render = (now) => {
  const progress = (now % config.durationMs) / config.durationMs;
  const pulseProgress = (now % config.pulseDurationMs) / config.pulseDurationMs;
  const detailScale = 0.52 + ((Math.sin(pulseProgress * Math.PI * 2 + 0.55) + 1) / 2) * 0.48;

  if (config.rotate) {
    rotation.value = -((now % config.rotationDurationMs) / config.rotationDurationMs) * 360;
  }

  let d = "";
  for (let i = 0; i <= 480; i++) {
    const p = getPoint(i / 480, detailScale);
    d += `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }
  pathData.value = d;

  particleStyles.value = Array.from({ length: config.particleCount }, (_, i) => {
    const tailOffset = i / (config.particleCount - 1);
    const pProgress = (((progress - tailOffset * config.trailSpan) % 1) + 1) % 1;
    const point = getPoint(pProgress, detailScale);
    const fade = Math.pow(1 - tailOffset, 0.56);
    return {
      x: point.x.toFixed(2),
      y: point.y.toFixed(2),
      radius: (0.9 + fade * 2.7).toFixed(2),
      opacity: (0.04 + fade * 0.96).toFixed(3),
    };
  });
};

function frame(now) {
  render(now);
  rafId = requestAnimationFrame(frame);
}

function startAnimation() {
  if (running) return;
  running = true;
  render(performance.now());
  rafId = requestAnimationFrame(frame);
}

function stopAnimation() {
  if (!running) return;
  running = false;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

onMounted(() => {
  // 始终执行一帧渲染，确保挂载后 SVG 有内容
  render(performance.now());
  if (props.streaming) {
    rafId = requestAnimationFrame(frame);
  }
});

watch(
  () => props.streaming,
  (val) => {
    if (val) startAnimation();
    else stopAnimation();
  },
);

onUnmounted(() => stopAnimation());
</script>

<template>
  <div class="relative flex aspect-square w-11 items-center justify-center">
    <div class="absolute inset-0 animate-pulse rounded-full"></div>

    <svg viewBox="0 0 100 100" fill="none" class="relative h-full w-full overflow-visible">
      <g :style="{ transform: `rotate(${rotation}deg)`, transformOrigin: '50px 50px' }">
        <path
          :d="pathData"
          stroke="currentColor"
          :class="props.streaming ? 'text-white/50' : 'text-white'"
          stroke-linecap="round"
          stroke-linejoin="round"
          :stroke-width="config.strokeWidth"
        />
        <circle
          v-if="props.streaming"
          v-for="(p, index) in particleStyles"
          :key="index"
          class="fill-white"
          :cx="p.x"
          :cy="p.y"
          :r="p.radius"
          :opacity="p.opacity"
        />
      </g>
    </svg>
  </div>
</template>
