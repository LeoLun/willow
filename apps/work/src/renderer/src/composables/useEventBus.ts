import { electronAPI } from "@/lib/ipc";

const listeners = new Map<string, Set<(data: any) => void>>();
let registrationPromise: Promise<void> | undefined;

function ensureRegistered() {
  if (registrationPromise) return registrationPromise;

  registrationPromise = electronAPI
    .registerEvent({}, (event, data) => {
      listeners.get(event)?.forEach((cb) => cb(data));
    })
    .then(() => undefined)
    .catch((e) => {
      registrationPromise = undefined;
      console.error("EventBus registerEvent failed:", e);
      throw e;
    });
  return registrationPromise;
}

export function useEventBus() {
  void ensureRegistered().catch(() => undefined);

  const addEventListener = (event: string, callback: (data: any) => void) => {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(callback);
  };

  const removeEventListener = (event: string, callback: (data: any) => void) => {
    listeners.get(event)?.delete(callback);
  };

  const waitUntilReady = () => ensureRegistered();

  return {
    addEventListener,
    removeEventListener,
    waitUntilReady,
  };
}
