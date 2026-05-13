import { onUnmounted, ref } from "vue";

interface UseDragResizeOptions {
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  storageKey: string;
}

export function useDragResize(options: UseDragResizeOptions) {
  const { minWidth, maxWidth, defaultWidth, storageKey } = options;

  const stored = localStorage.getItem(storageKey);
  const parsed = stored ? parseInt(stored, 10) : NaN;
  const initialWidth =
    !Number.isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth ? parsed : defaultWidth;

  const width = ref(initialWidth);
  const isDragging = ref(false);

  let startX = 0;
  let startWidth = 0;

  function onMouseMove(e: MouseEvent) {
    const delta = startX - e.clientX;
    const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));
    width.value = newWidth;
  }

  function onMouseUp() {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    isDragging.value = false;
    localStorage.setItem(storageKey, String(width.value));
  }

  function onMouseDown(e: MouseEvent) {
    e.preventDefault();
    startX = e.clientX;
    startWidth = width.value;
    isDragging.value = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function onDblClick() {
    width.value = defaultWidth;
    localStorage.setItem(storageKey, String(defaultWidth));
  }

  onUnmounted(() => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });

  return { width, isDragging, onMouseDown, onDblClick };
}
