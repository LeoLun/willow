import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRenderer, defineComponent, nextTick } from "vue";

const mocks = vi.hoisted(() => ({
  listeners: new Map<string, (data: unknown) => void>(),
  manageMcp: vi.fn(async () => undefined),
}));
vi.mock("@/composables/useEventBus", () => ({
  useEventBus: () => ({
    addEventListener: (name: string, callback: (data: unknown) => void) =>
      mocks.listeners.set(name, callback),
    removeEventListener: (name: string) => mocks.listeners.delete(name),
  }),
}));
vi.mock("@/lib/ipc", () => ({ electronAPI: { manageMcp: mocks.manageMcp } }));
vi.mock("@/components/dialog/mcp/McpLoginDialog.vue", () => ({
  default: { name: "McpLoginDialog" },
}));
vi.mock(
  "@/components/dialog",
  async () => import("../src/renderer/src/components/dialog/use-dialog"),
);
import { useDialog } from "../src/renderer/src/components/dialog/use-dialog";
import { useMcpLogin } from "../src/renderer/src/composables/useMcpLogin";

const renderer = createRenderer<object, object>({
  createElement: () => ({}),
  createText: () => ({}),
  createComment: () => ({}),
  insert: () => {},
  remove: () => {},
  setText: () => {},
  setElementText: () => {},
  patchProp: () => {},
  parentNode: () => null,
  nextSibling: () => null,
});
let app: ReturnType<typeof renderer.createApp>;
const { dialogState, openDialog, closeDialog } = useDialog();
beforeEach(() => {
  dialogState.value = null;
  mocks.listeners.clear();
  app = renderer.createApp(
    defineComponent({
      setup() {
        useMcpLogin();
        return () => null;
      },
    }),
  );
  app.mount({});
});
afterEach(() => {
  app.unmount();
  dialogState.value = null;
});
function request(serverName: string, cancelled = false) {
  mocks.listeners.get("mcp:auth-required")?.({ workspaceId: 1, serverName, cancelled });
}

describe("MCP login dialog guidance", () => {
  it("opens guidance, deduplicates requests and cancels on dismissal", async () => {
    request("figma");
    request("figma");
    await nextTick();
    expect(dialogState.value?.open).toBe(true);
    expect(dialogState.value?.props?.serverName).toBe("figma");
    closeDialog();
    await nextTick();
    expect(mocks.manageMcp).toHaveBeenCalledTimes(1);
    expect(mocks.manageMcp).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 1, serverName: "figma", action: "cancel-login" }),
    );
    expect(dialogState.value?.open).toBe(false);
  });
  it("queues guidance behind existing dialogs and other services", async () => {
    const existing = defineComponent({ render: () => null });
    openDialog(existing);
    request("figma");
    request("other");
    await nextTick();
    expect(dialogState.value?.component).toBe(existing);
    closeDialog();
    await nextTick();
    expect(dialogState.value?.props?.serverName).toBe("figma");
    closeDialog();
    await nextTick();
    expect(dialogState.value?.props?.serverName).toBe("other");
  });
  it("closes guidance when the originating task cancels", async () => {
    request("figma");
    await nextTick();
    request("figma", true);
    await nextTick();
    expect(dialogState.value?.open).toBe(false);
  });
});
