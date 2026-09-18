import type { McpAuthRequiredEvent } from "@shared/api";
import { MCP_AUTH_REQUIRED_EVENT } from "@shared/constants";
import { onMounted, onUnmounted, watch } from "vue";
import { useDialog } from "@/components/dialog";
import McpLoginDialog from "@/components/dialog/mcp/McpLoginDialog.vue";
import { electronAPI } from "@/lib/ipc";
import { useEventBus } from "./useEventBus";

export function useMcpLogin() {
  const { dialogState, openDialog, closeDialog } = useDialog();
  const { addEventListener, removeEventListener } = useEventBus();
  const pending: McpAuthRequiredEvent[] = [];
  let active: McpAuthRequiredEvent | undefined;
  const key = (event: McpAuthRequiredEvent) =>
    `${event.scope === "global" ? "global" : event.workspaceId}:${event.serverName}`;
  function next() {
    if (active || dialogState.value?.open) return;
    active = pending.shift();
    if (active) openDialog(McpLoginDialog, { ...active });
  }
  function onRequired(event: McpAuthRequiredEvent) {
    if (event.cancelled) {
      const index = pending.findIndex((item) => key(item) === key(event));
      if (index !== -1) pending.splice(index, 1);
      if (active && key(active) === key(event)) closeDialog();
      return;
    }
    if (active && key(active) === key(event)) return;
    if (!pending.some((item) => key(item) === key(event))) pending.push(event);
    next();
  }
  const stop = watch(dialogState, (state) => {
    if (active && (!state?.open || state.component !== McpLoginDialog)) {
      const request = active;
      active = undefined;
      void electronAPI
        .manageMcp({
          ...(request.scope === "global"
            ? { scope: "global" as const }
            : { workspaceId: request.workspaceId }),
          serverName: request.serverName,
          action: "cancel-login",
        })
        .catch(() => undefined);
    }
    next();
  });
  onMounted(() => addEventListener(MCP_AUTH_REQUIRED_EVENT, onRequired));
  onUnmounted(() => {
    stop();
    removeEventListener(MCP_AUTH_REQUIRED_EVENT, onRequired);
    for (const event of [...pending, ...(active ? [active] : [])]) {
      void electronAPI
        .manageMcp({
          ...(event.scope === "global"
            ? { scope: "global" as const }
            : { workspaceId: event.workspaceId }),
          serverName: event.serverName,
          action: "cancel-login",
        })
        .catch(() => undefined);
    }
  });
}
