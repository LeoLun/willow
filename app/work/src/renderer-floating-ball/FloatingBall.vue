<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import BallStreaming from "./BallStreaming.vue";

const isStreaming = ref(false);
const windowPos = ref({ x: 0, y: 0 });
let offsetX = 0;
let offsetY = 0;
let mouseDownOnBall = false;
let movedDuringDrag = false;

function handleEvent(eventName: string, data: any) {
  if (eventName === "UPDATE_MESSAGE") {
    const eventType = data?.event?.type;
    if (eventType === "agent_start") {
      isStreaming.value = true;
    } else if (eventType === "agent_end") {
      isStreaming.value = false;
    }
  }
}

onMounted(async () => {
  window.electronAPI.registerEvent({}, handleEvent);

  const { config } = await window.electronAPI.getFloatingBallConfig();
  if (config.x >= 0 && config.y >= 0) {
    windowPos.value = { x: config.x, y: config.y };
  }
});

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  mouseDownOnBall = true;
  movedDuringDrag = false;
  offsetX = e.screenX - windowPos.value.x;
  offsetY = e.screenY - windowPos.value.y;
}

function onMouseMove(e: MouseEvent) {
  if (!mouseDownOnBall) return;
  movedDuringDrag = true;
  const x = e.screenX - offsetX;
  const y = e.screenY - offsetY;
  windowPos.value = { x, y };
  window.electronAPI.moveFloatingBallWindow({ x, y });
}

function onMouseUp(e: MouseEvent) {
  if (!mouseDownOnBall) return;
  mouseDownOnBall = false;

  if (e.button !== 0) return;

  if (movedDuringDrag) {
    window.electronAPI.setFloatingBallPosition({
      x: windowPos.value.x,
      y: windowPos.value.y,
    });
  }
}

window.addEventListener("mousemove", onMouseMove);
window.addEventListener("mouseup", onMouseUp);

onUnmounted(() => {
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseUp);
});

function onContextMenu(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  window.electronAPI.showFloatingBallMenu();
}
function onClick(e: MouseEvent) {
  if (e.button !== 0) return;
  if (movedDuringDrag) {
    movedDuringDrag = false;
    return;
  }
  window.electronAPI.showMainWindow();
}
</script>

<template>
  <div
    class="floating-ball-container flex h-screen w-screen items-center justify-center overflow-hidden bg-transparent"
  >
    <div
      class="flex h-[50px] w-[50px] cursor-pointer items-center justify-center rounded-full bg-black transition-transform select-none"
      @mousedown="onMouseDown"
      @contextmenu="onContextMenu"
      @click.left="onClick"
    >
      <BallStreaming :streaming="isStreaming" />
    </div>
  </div>
</template>
