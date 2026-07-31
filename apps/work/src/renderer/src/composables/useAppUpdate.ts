import type { AppUpdateState } from "@shared/api";
import { APP_UPDATE_EVENT } from "@shared/constants";
import { createGlobalState } from "@vueuse/core";
import { computed, onBeforeUnmount, onMounted, readonly, shallowRef } from "vue";
import { electronAPI } from "@/lib/ipc";
import { useEventBus } from "./useEventBus";

const useAppUpdateState = createGlobalState(() => {
  const state = shallowRef<AppUpdateState>({
    status: "upToDate",
    currentVersion: "1.0.0",
  });
  let checkPromise: Promise<AppUpdateState> | undefined;

  function setState(value: AppUpdateState): void {
    state.value = value;
  }

  function checkForUpdate(): Promise<AppUpdateState> {
    checkPromise ??= electronAPI
      .checkForUpdate()
      .then((value) => {
        setState(value);
        return value;
      })
      .finally(() => {
        checkPromise = undefined;
      });
    return checkPromise;
  }

  async function downloadUpdate(): Promise<void> {
    setState(await electronAPI.downloadUpdate());
  }

  async function restartToUpdate(): Promise<void> {
    await electronAPI.restartToUpdate();
  }

  async function openManualUpdate(): Promise<void> {
    await electronAPI.openManualUpdate();
  }

  async function confirmUpdateBoot(): Promise<void> {
    setState(await electronAPI.confirmUpdateBoot());
  }

  return {
    state,
    setState,
    checkForUpdate,
    downloadUpdate,
    restartToUpdate,
    openManualUpdate,
    confirmUpdateBoot,
  };
});

export function useAppUpdate() {
  const update = useAppUpdateState();
  return {
    state: readonly(update.state),
    visible: computed(() =>
      ["hotAvailable", "manualAvailable", "downloading", "ready", "downloadFailed"].includes(
        update.state.value.status,
      ),
    ),
    checkForUpdate: update.checkForUpdate,
    downloadUpdate: update.downloadUpdate,
    restartToUpdate: update.restartToUpdate,
    openManualUpdate: update.openManualUpdate,
    confirmUpdateBoot: update.confirmUpdateBoot,
  };
}

export function useAppUpdateListener(): void {
  const { setState } = useAppUpdateState();
  const { addEventListener, removeEventListener, waitUntilReady } = useEventBus();
  let receivedEventCount = 0;
  let mounted = false;

  function handleStateEvent(state: AppUpdateState): void {
    receivedEventCount += 1;
    setState(state);
  }

  onMounted(() => {
    mounted = true;
    addEventListener(APP_UPDATE_EVENT, handleStateEvent);
    void waitUntilReady()
      .then(async () => {
        const eventCountBeforeRequest = receivedEventCount;
        const state = await electronAPI.getUpdateState();
        if (mounted && receivedEventCount === eventCountBeforeRequest) setState(state);
      })
      .catch((error) => {
        console.error("同步应用更新状态失败:", error);
      });
  });

  onBeforeUnmount(() => {
    mounted = false;
    removeEventListener(APP_UPDATE_EVENT, handleStateEvent);
  });
}
