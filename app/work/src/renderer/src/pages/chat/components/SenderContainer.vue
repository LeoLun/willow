<script setup lang="ts">
import type {
  SelectedSystemFile,
  SendMessage,
  SkillSummary,
  WorkspaceAgentSummary,
  WorkspaceFileNode,
} from "@shared/api";
import type {
  SenderBuiltinCommandOption,
  SenderFileOption,
  SenderSendPayload,
  SenderWorkspaceAgentOption,
} from "@willow/sender";
import { Sender } from "@willow/sender";
import { storeToRefs } from "pinia";
import { computed, onBeforeMount, ref, toRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useWorkspaceFiles } from "@/composables/useWorkspaceFiles";
import { electronAPI } from "@/lib/ipc";
import { useConfigStore } from "@/stores/config";

const props = withDefaults(
  defineProps<{
    messages?: { usage?: { input?: number; output?: number } }[];
    isStreaming?: boolean;
    streamMessage?: { usage?: { input?: number; output?: number } } | null;
    showUsage?: boolean;
    workspaceId?: number;
    chatScope?: "conversation" | "workspace";
  }>(),
  {
    messages: () => [],
    isStreaming: false,
    streamMessage: null,
    showUsage: true,
    workspaceId: 0,
    chatScope: "workspace",
  },
);

const emit = defineEmits<{
  send: [request: SendMessage];
  stop: [];
}>();

const router = useRouter();
const route = useRoute();
const configStore = useConfigStore();
const { modelList, defaultModel } = storeToRefs(configStore);
const workspaceFiles = useWorkspaceFiles(toRef(props, "workspaceId"));

const skills = ref<SkillSummary[]>([]);
const isSkillsLoading = ref(false);
const skillsErrorMessage = ref("");
const workspaceAgents = ref<WorkspaceAgentSummary[]>([]);
const isWorkspaceAgentsLoading = ref(false);
const workspaceAgentsErrorMessage = ref("");

const builtinCommands = computed<SenderBuiltinCommandOption[]>(() => {
  if (props.chatScope !== "workspace") {
    return [];
  }
  return [
    {
      id: "init",
      name: "/init",
      description: "分析当前工作空间并创建或改进 AGENTS.md",
    },
  ];
});

const senderWorkspaceAgents = computed<SenderWorkspaceAgentOption[]>(() =>
  workspaceAgents.value
    .filter((agent) => agent.available)
    .map((agent) => ({
      workspaceId: agent.workspaceId,
      workspaceName: agent.workspaceName,
      workspacePath: agent.workspacePath,
      agentName: agent.agentName,
      agentDescription: agent.agentDescription,
    })),
);

const senderFiles = computed<SenderFileOption[]>(() =>
  flattenWorkspaceFiles(workspaceFiles.files.value, workspaceFiles.rootPath.value),
);

onBeforeMount(async () => {
  if (modelList.value.length === 0) {
    await configStore.fetchModelList();
  }
});

watch(
  () => [props.workspaceId, props.chatScope],
  async () => {
    await loadAvailableSkills();
    await loadWorkspaceAgents();
  },
  { immediate: true },
);

async function loadAvailableSkills() {
  isSkillsLoading.value = true;
  skillsErrorMessage.value = "";

  try {
    const response = await electronAPI.getAvailableSkills({
      workspaceId: props.workspaceId || undefined,
    });
    skills.value = response.skills;
  } catch (error) {
    skills.value = [];
    skillsErrorMessage.value = error instanceof Error ? error.message : "读取技能失败";
  } finally {
    isSkillsLoading.value = false;
  }
}

async function loadWorkspaceAgents() {
  if (props.chatScope !== "conversation") {
    workspaceAgents.value = [];
    workspaceAgentsErrorMessage.value = "";
    isWorkspaceAgentsLoading.value = false;
    return;
  }

  isWorkspaceAgentsLoading.value = true;
  workspaceAgentsErrorMessage.value = "";

  try {
    const response = await electronAPI.getWorkspaceAgents();
    workspaceAgents.value = response.agents;
  } catch (error) {
    workspaceAgents.value = [];
    workspaceAgentsErrorMessage.value =
      error instanceof Error ? error.message : "读取工作空间 Agent 失败";
  } finally {
    isWorkspaceAgentsLoading.value = false;
  }
}

function handleOpenSettings() {
  router.push({
    path: "/setting/configuration",
    query: { from: route.fullPath },
  });
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/");
}

function getRelativePath(path: string, rootPath: string) {
  const normalizedPath = normalizePath(path);
  const normalizedRoot = normalizePath(rootPath).replace(/\/+$/, "");
  if (!normalizedRoot) {
    return normalizedPath;
  }
  if (normalizedPath === normalizedRoot) {
    return "";
  }
  if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
    return normalizedPath.slice(normalizedRoot.length + 1);
  }
  return normalizedPath;
}

function isWithinWorkspace(path: string, rootPath: string) {
  const normalizedPath = normalizePath(path);
  const normalizedRoot = normalizePath(rootPath).replace(/\/+$/, "");
  return Boolean(normalizedRoot) && normalizedPath.startsWith(`${normalizedRoot}/`);
}

function getFileExtension(file: SelectedSystemFile) {
  if (file.extension) return file.extension;
  const extensionMatch = file.name.match(/\.([^.]+)$/);
  return extensionMatch?.[1];
}

function mapSystemFile(file: SelectedSystemFile, rootPath: string): SenderFileOption {
  return {
    name: file.name,
    path: file.path,
    relativePath: isWithinWorkspace(file.path, rootPath)
      ? getRelativePath(file.path, rootPath)
      : file.name,
    extension: getFileExtension(file),
    size: file.size,
  };
}

function flattenWorkspaceFiles(nodes: WorkspaceFileNode[], rootPath: string): SenderFileOption[] {
  return nodes.flatMap((node) => {
    if (node.type === "folder") {
      return flattenWorkspaceFiles(node.children ?? [], rootPath);
    }
    return [
      {
        name: node.name,
        path: node.path,
        relativePath: getRelativePath(node.path, rootPath),
        extension: node.extension,
        size: node.size,
      },
    ];
  });
}

async function handleSelectFiles(insertFiles: (files: SenderFileOption[]) => void) {
  try {
    const response = await electronAPI.selectFiles({
      defaultPath: workspaceFiles.rootPath.value || undefined,
      multiSelections: true,
    });
    if (!response.selected) {
      return;
    }
    insertFiles(response.files.map((file) => mapSystemFile(file, workspaceFiles.rootPath.value)));
  } catch (error) {
    console.error(error);
  }
}

function handleSend(request: SenderSendPayload) {
  const nextRequest: SendMessage = {
    message: request.message,
    modelId: request.modelId,
    selectedBuiltinCommand: request.selectedBuiltinCommand,
    selectedFiles: request.selectedFiles,
    selectedWorkspaceAgent: request.selectedWorkspaceAgent,
    webSearchEnabled: request.webSearchEnabled,
  };
  console.log("[SenderContainer] handleSend");
  emit("send", nextRequest);
}
</script>

<template>
  <Sender
    :messages="messages"
    :stream-message="streamMessage"
    :is-streaming="isStreaming"
    :show-usage="showUsage"
    :models="modelList"
    :default-model-id="defaultModel?.modelId ?? ''"
    :builtin-commands="builtinCommands"
    :workspace-agents="senderWorkspaceAgents"
    :workspace-agents-loading="isWorkspaceAgentsLoading"
    :workspace-agents-error-message="workspaceAgentsErrorMessage"
    :skills="skills"
    :skills-loading="isSkillsLoading"
    :skills-error-message="skillsErrorMessage"
    :files="senderFiles"
    :files-loading="workspaceFiles.isLoading.value"
    :files-error-message="workspaceFiles.errorMessage.value"
    @send="handleSend"
    @stop="emit('stop')"
    @open-settings="handleOpenSettings"
    @select-files="handleSelectFiles"
  />
</template>
