import { electronAPI } from "@/lib/ipc";

const listeners = new Map<string, Set<(data: any) => void>>();
let initialized = false;

function ensureRegistered() {
  if (initialized) return;
  initialized = true;
  electronAPI
    .registerEvent({}, (event, data) => {
      listeners.get(event)?.forEach((cb) => cb(data));
    })
    .catch((e) => {
      initialized = false;
      console.error("EventBus registerEvent failed:", e);
    });
}

export function useEventBus() {
  ensureRegistered();

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
