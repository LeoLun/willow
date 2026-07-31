// @vitest-environment jsdom

import type { AppUpdateState } from "@shared/api";
import { APP_UPDATE_EVENT } from "@shared/constants";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, type App } from "vue";

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  getUpdateState: vi.fn(),
  removeEventListener: vi.fn(),
  waitUntilReady: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  electronAPI: {
    getUpdateState: mocks.getUpdateState,
  },
}));

vi.mock("@/composables/useEventBus", () => ({
  useEventBus: () => ({
    addEventListener: mocks.addEventListener,
    removeEventListener: mocks.removeEventListener,
    waitUntilReady: mocks.waitUntilReady,
  }),
}));

import { useAppUpdate, useAppUpdateListener } from "../src/renderer/src/composables/useAppUpdate";

const mountedApps: App[] = [];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function mountListener(): ReturnType<typeof useAppUpdate> {
  let update!: ReturnType<typeof useAppUpdate>;
  const app = createApp({
    setup() {
      useAppUpdateListener();
      update = useAppUpdate();
      return () => null;
    },
  });
  app.mount(document.createElement("div"));
  mountedApps.push(app);
  return update;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.waitUntilReady.mockResolvedValue(undefined);
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
});

describe("useAppUpdate", () => {
  it("hydrates the downloaded update state after the event listener is ready", async () => {
    const readyState: AppUpdateState = {
      status: "ready",
      currentVersion: "1.0.0",
      latestVersion: "1.0.1",
      progress: 100,
    };
    mocks.getUpdateState.mockResolvedValue(readyState);

    const update = mountListener();

    await vi.waitFor(() => expect(update.state.value).toEqual(readyState));
    expect(mocks.addEventListener).toHaveBeenCalledWith(APP_UPDATE_EVENT, expect.any(Function));
    expect(mocks.waitUntilReady).toHaveBeenCalledOnce();
  });

  it("does not overwrite a newer update event with an older state request", async () => {
    const stateRequest = deferred<AppUpdateState>();
    mocks.getUpdateState.mockReturnValue(stateRequest.promise);
    const update = mountListener();
    await vi.waitFor(() => expect(mocks.getUpdateState).toHaveBeenCalledOnce());

    const handleStateEvent = mocks.addEventListener.mock.calls[0]?.[1] as (
      state: AppUpdateState,
    ) => void;
    const readyState: AppUpdateState = {
      status: "ready",
      currentVersion: "1.0.0",
      latestVersion: "1.0.1",
      progress: 100,
    };
    handleStateEvent(readyState);
    stateRequest.resolve({
      status: "downloading",
      currentVersion: "1.0.0",
      latestVersion: "1.0.1",
      progress: 99,
    });

    await vi.waitFor(() => expect(update.state.value).toEqual(readyState));
  });
});
