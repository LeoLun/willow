import type { McpServerConfig } from "@shared/api";
import { defineStore } from "pinia";
import { ref } from "vue";
import { electronAPI } from "@/lib/ipc";

export const useMcpStore = defineStore("mcp", () => {
  const globalServers = ref<McpServerConfig[]>([]);
  const workspaceServers = ref<McpServerConfig[]>([]);

  async function fetchGlobalServers() {
    const response = await electronAPI.getMcpServers({});
    globalServers.value = response.servers || [];
    return globalServers.value;
  }

  async function fetchWorkspaceServers(workspaceId: number) {
    const response = await electronAPI.getMcpServers({ workspaceId });
    workspaceServers.value = response.servers || [];
    return workspaceServers.value;
  }

  async function addServer(workspaceId: number | undefined, config: McpServerConfig) {
    const response = await electronAPI.addMcpServer({ workspaceId, config });
    if (workspaceId) {
      workspaceServers.value = response.servers || [];
    } else {
      globalServers.value = response.servers || [];
    }
  }

  async function updateServer(workspaceId: number | undefined, config: McpServerConfig) {
    const response = await electronAPI.updateMcpServer({ workspaceId, config });
    if (workspaceId) {
      workspaceServers.value = response.servers || [];
    } else {
      globalServers.value = response.servers || [];
    }
  }

  async function deleteServer(workspaceId: number | undefined, name: string) {
    const response = await electronAPI.deleteMcpServer({ workspaceId, name });
    if (workspaceId) {
      workspaceServers.value = response.servers || [];
    } else {
      globalServers.value = response.servers || [];
    }
  }

  async function toggleServer(workspaceId: number | undefined, name: string, disabled: boolean) {
    const response = await electronAPI.toggleMcpServer({ workspaceId, name, disabled });
    if (workspaceId) {
      workspaceServers.value = response.servers || [];
    } else {
      globalServers.value = response.servers || [];
    }
  }

  return {
    globalServers,
    workspaceServers,
    fetchGlobalServers,
    fetchWorkspaceServers,
    addServer,
    updateServer,
    deleteServer,
    toggleServer,
  };
});
