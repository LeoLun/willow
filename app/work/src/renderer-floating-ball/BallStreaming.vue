<script setup lang="ts">
import { computed } from "vue";

const props = defineProps({
  streaming: {
    type: Boolean,
    default: false,
  },
  hovered: {
    type: Boolean,
    default: false,
  },
});

// Extensible state machine determining current face mood/state
const activeState = computed(() => {
  if (props.streaming) return "thinking";
  if (props.hovered) return "hover";
  return "idle";
});

// Dynamic SVG paths for Eyebrows (widened to match glasses)
const leftEyebrowPath = computed(() => {
  switch (activeState.value) {
    case "hover":
      return "M 19 26 Q 30 20 41 26";
    case "thinking":
      return "M 19 24 Q 30 19 41 27";
    case "idle":
    default:
      return "M 19 29 Q 30 23 41 29";
  }
});

const rightEyebrowPath = computed(() => {
  switch (activeState.value) {
    case "hover":
      return "M 59 26 Q 70 20 81 26";
    case "thinking":
      return "M 59 29 Q 70 32 81 28";
    case "idle":
    default:
      return "M 59 29 Q 70 23 81 29";
  }
});

// Dynamic Eye centers (widened to match glasses)
const leftEyePos = computed(() => {
  if (activeState.value === "thinking") {
    return { cx: 32, cy: 45 };
  }
  return { cx: 30, cy: 48 };
});

const rightEyePos = computed(() => {
  if (activeState.value === "thinking") {
    return { cx: 68, cy: 45 };
  }
  return { cx: 70, cy: 48 };
});

// Dynamic mouth paths (widened to balance features)
const mouthPath = computed(() => {
  switch (activeState.value) {
    case "hover":
      return "M 38 70 Q 50 78 62 70";
    case "thinking":
      return "M 41 73 Q 50 69 59 72";
    case "idle":
    default:
      return "M 41 72 Q 50 72 59 72";
  }
});
</script>

<template>
  <div class="relative flex aspect-square w-11 items-center justify-center select-none">
    <svg viewBox="0 0 100 100" fill="none" class="relative h-full w-full overflow-visible">
      <!-- Outer Face Group (gentle float animation during thinking) -->
      <g :class="{ 'animate-float': activeState === 'thinking' }">
        <!-- Eyebrows -->
        <path
          :d="leftEyebrowPath"
          stroke="currentColor"
          stroke-width="4.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          :d="rightEyebrowPath"
          stroke="currentColor"
          stroke-width="4.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          :class="{ 'animate-wiggle-brow': activeState === 'thinking' }"
        />

        <!-- Glasses Frames & Bridge (Separated and enlarged to cover more space) -->
        <circle cx="30" cy="48" r="13" stroke="currentColor" stroke-width="3.5" fill="none" />
        <circle cx="70" cy="48" r="13" stroke="currentColor" stroke-width="3.5" fill="none" />
        <path
          d="M 43 48 Q 50 46 57 48"
          stroke="currentColor"
          stroke-width="3.5"
          stroke-linecap="round"
        />

        <!-- Eyes (Blinking on normal/hover, scanning around on thinking) -->
        <g :class="{ 'animate-look-around': activeState === 'thinking' }">
          <circle
            :cx="leftEyePos.cx"
            :cy="leftEyePos.cy"
            r="3"
            fill="currentColor"
            :class="{ 'animate-blink': activeState !== 'thinking' }"
          />
          <circle
            :cx="rightEyePos.cx"
            :cy="rightEyePos.cy"
            r="3"
            fill="currentColor"
            :class="{ 'animate-blink-right': activeState !== 'thinking' }"
          />
        </g>

        <!-- Nose -->
        <path
          d="M 49 49 L 49 58 Q 49 60 52 60"
          stroke="currentColor"
          stroke-width="4.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Mouth -->
        <path
          :d="mouthPath"
          stroke="currentColor"
          stroke-width="4.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </g>
    </svg>
  </div>
</template>

<style scoped>
path {
  transition:
    d 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    stroke-width 0.35s ease;
}
circle {
  transition:
    cx 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    cy 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    r 0.35s ease;
}

/* Eyebrow wiggle animation when thinking (amplified to be more noticeable) */
@keyframes wiggle-brow {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-3px) rotate(-4.5deg);
  }
}
.animate-wiggle-brow {
  animation: wiggle-brow 2.2s ease-in-out infinite;
  transform-origin: 70px 29px;
}

/* Eyes blinking animation when normal or hovered */
@keyframes blink {
  0%,
  96%,
  100% {
    transform: scaleY(1);
  }
  98% {
    transform: scaleY(0.1);
  }
}
.animate-blink {
  animation: blink 4s infinite;
  transform-origin: 30px 48px;
}
.animate-blink-right {
  animation: blink 4s infinite;
  transform-origin: 70px 48px;
}

/* Looking around (thinking scan - wider range and slightly faster for visibility) */
@keyframes look-around {
  0%,
  100% {
    transform: translate(0, 0);
  }
  25% {
    transform: translate(-3px, -0.8px);
  }
  50% {
    transform: translate(0, -2.2px);
  }
  75% {
    transform: translate(3px, -0.8px);
  }
}
.animate-look-around {
  animation: look-around 4s ease-in-out infinite;
}

/* Breathing/Floating Face animation when thinking (enhanced floating range) */
@keyframes float-face {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3.5px);
  }
}
.animate-float {
  animation: float-face 3.2s ease-in-out infinite;
}
</style>
