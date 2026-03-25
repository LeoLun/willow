import { electronAPI } from "@/lib/ipc";

const listeners = new Map<string, Set<(data: any) => void>>();

electronAPI.registerEvent({}, (event, data) => {
  listeners.get(event)?.forEach((cb) => cb(data));
});

export function useEventBus() {
  const addEventListener = (event: string, callback: (data: any) => void) => {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(callback);
  };

  const removeEventListener = (event: string, callback: (data: any) => void) => {
    listeners.get(event)?.delete(callback);
  };

  return {
    addEventListener,
    removeEventListener,
  };
}
