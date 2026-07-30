import type { Rectangle } from "electron";

const DEFAULT_WINDOW_WIDTH = 1400;
const DEFAULT_WINDOW_HEIGHT = 900;

export function calculateDefaultWindowBounds(workArea: Rectangle): Rectangle {
  return {
    x: workArea.x + Math.floor((workArea.width - DEFAULT_WINDOW_WIDTH) / 2),
    y: workArea.y + Math.floor((workArea.height - DEFAULT_WINDOW_HEIGHT) / 2),
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
  };
}
