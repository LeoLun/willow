<script setup lang="ts">
import type {
  FileSearchItem,
  MessageEventPayload,
  ModelConfig,
  PermissionMode,
  ProviderInfo,
  SkillInfo,
  ThinkingLevel,
  ToolApprovalDecision,
} from "@shared/api";
import { MESSAGE_EVENT } from "@shared/constants";
import { ShieldCheckIcon, ShieldQuestionIcon, UserCheckIcon } from "lucide-vue-next";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { isNavigationFailure, useRoute, useRouter } from "vue-router";
import { useDialog } from "@/components/dialog";
import SettingDialog from "@/components/dialog/setting/Setting.vue";
import BaseHeader from "@/components/layout/BaseHeader.vue";
import {
  defaultComposerTokenRules,
  PromptComposer,
  serializeFileToken,
  type ComposerModelOption,
  type ComposerOption,
  type ComposerPanelSlotProps,
  type ComposerPanelKeydownPayload,
  type ComposerPanelNavigationHandle,
  type ComposerSubmitPayload,
} from "@/components/prompt-composer";
import FileSearchPanel from "@/components/prompt-composer/FileSearchPanel.vue";
import QueuedMessageList from "@/components/prompt-composer/QueuedMessageList.vue";
import SkillSearchPanel from "@/components/prompt-composer/SkillSearchPanel.vue";
import { TodoListPanel } from "@/components/todo-list";
import ToolApprovalPanel from "@/components/tool/ToolApprovalPanel.vue";
import { useComposerPreferences } from "@/composables/useComposerPreferences";
import { useEventBus } from "@/composables/useEventBus";
import { useMessageStatus, useSessionMessages } from "@/composables/useMessage";
import { useMessageQueue } from "@/composables/useMessageQueue";
import { useToolApproval } from "@/composables/useToolApproval";
import { onProviderConfigurationChanged } from "@/lib/app-state-events";
import { electronAPI } from "@/lib/ipc";

const route = useRoute();
const router = useRouter();
const { openDialog } = useDialog();
const { addEventListener, removeEventListener, waitUntilReady } = useEventBus();
const { isSessionRunning } = useMessageStatus();
const messageQueue = useMessageQueue();
const composerPreferences = useComposerPreferences();
const message = ref("");
const creatingSession = ref(false);
const creationError = ref("");
const sessionTitle = ref("");
const loadingModels = ref(true);
const modelLoadError = ref(false);
const providers = shallowRef<ProviderInfo[]>([]);
const selectedModel = shallowRef<ModelConfig | undefined>(composerPreferences.value.model);
const approvalMode = ref<PermissionMode>(composerPreferences.value.approvalMode);
const reasoningEffort = ref<string | undefined>(composerPreferences.value.reasoningEffort);
const fileSearchPanel = shallowRef<ComposerPanelNavigationHandle>();
const skillSearchPanel = shallowRef<ComposerPanelNavigationHandle>();

const approvalOptions: ComposerOption[] = [
  { value: "request-approval", label: "请求批准", icon: ShieldQuestionIcon },
  { value: "delegate-approval", label: "替我审批", icon: UserCheckIcon },
  { value: "full-access", label: "完全访问权限", icon: ShieldCheckIcon },
];
const thinkingLevelOrder: ThinkingLevel[] = ["minimal", "low", "medium", "high", "xhigh", "max"];

const workspaceId = computed(() => {
  const value = Number(route.query.workspaceId);
  return Number.isInteger(value) && value > 0 ? value : undefined;
});

const sessionId = computed(() => {
  const value = route.params.sessionId;
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
});
const { todoList } = useSessionMessages(workspaceId, sessionId);
const { currentApproval, resolveApproval } = useToolApproval(workspaceId, sessionId);
const currentSessionRunning = computed(() => {
  const currentSessionId = sessionId.value;
  return currentSessionId ? isSessionRunning(currentSessionId) : false;
});
const currentSessionActive = computed(() => {
  const currentWorkspaceId = workspaceId.value;
  const currentSessionId = sessionId.value;
  return currentWorkspaceId !== undefined && currentSessionId !== undefined
    ? messageQueue.isSessionActive(currentWorkspaceId, currentSessionId)
    : false;
});
const currentSessionStreaming = computed(
  () => currentSessionRunning.value || currentSessionActive.value,
);
const currentSessionStopping = computed(() => {
  const currentWorkspaceId = workspaceId.value;
  const currentSessionId = sessionId.value;
  return currentWorkspaceId !== undefined && currentSessionId !== undefined
    ? messageQueue.isSessionStopping(currentWorkspaceId, currentSessionId)
    : false;
});
const queuedMessages = computed(() => {
  const currentWorkspaceId = workspaceId.value;
  const currentSessionId = sessionId.value;
  return currentWorkspaceId !== undefined && currentSessionId !== undefined
    ? messageQueue.getQueuedMessages(currentWorkspaceId, currentSessionId)
    : [];
});
const sendError = computed(() => {
  if (creationError.value) return creationError.value;
  const currentWorkspaceId = workspaceId.value;
  const currentSessionId = sessionId.value;
  return currentWorkspaceId !== undefined && currentSessionId !== undefined
    ? messageQueue.getSessionError(currentWorkspaceId, currentSessionId)
    : "";
});

const modelOptions = computed<ComposerModelOption[]>(() =>
  providers.value.flatMap((provider) =>
    provider.models.map((providerModel) => {
      const reasoningEfforts = providerModel.thinkingLevels.map((level) => ({
        value: level,
        label: level.charAt(0).toUpperCase() + level.slice(1),
      }));
      return {
        value: { providerId: provider.id, modelId: providerModel.id },
        label: providerModel.name,
        group: provider.name,
        reasoningEfforts,
        defaultReasoningEffort: getDefaultThinkingLevel(providerModel.thinkingLevels),
      };
    }),
  ),
);
const composerDisabled = computed(
  () =>
    workspaceId.value === undefined ||
    modelLoadError.value ||
    creatingSession.value ||
    (route.name !== "home" && sessionId.value === undefined),
);
const topBarTitle = computed(() =>
  route.name === "chat" ? sessionTitle.value.trim() || "新对话" : "",
);

let sessionTitleLoadGeneration = 0;
let modelLoadGeneration = 0;
let removeProviderConfigurationListener: (() => void) | undefined;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getDefaultThinkingLevel(levels: ThinkingLevel[]): ThinkingLevel | undefined {
  const mediumIndex = thinkingLevelOrder.indexOf("medium");
  for (let distance = 0; distance < thinkingLevelOrder.length; distance += 1) {
    const higher = thinkingLevelOrder[mediumIndex + distance];
    if (higher && levels.includes(higher)) return higher;

    const lower = thinkingLevelOrder[mediumIndex - distance];
    if (lower && levels.includes(lower)) return lower;
  }
  return undefined;
}

async function loadSessionTitle() {
  const currentWorkspaceId = workspaceId.value;
  const currentSessionId = sessionId.value;
  const generation = ++sessionTitleLoadGeneration;

  sessionTitle.value = "";
  if (route.name !== "chat" || !currentWorkspaceId || !currentSessionId) return;

  try {
    const response = await electronAPI.getSessionList({ workspaceId: currentWorkspaceId });
    if (generation !== sessionTitleLoadGeneration) return;
    sessionTitle.value =
      response.sessions.find((session) => session.id === currentSessionId)?.title ?? "";
  } catch (error) {
    if (generation !== sessionTitleLoadGeneration) return;
    console.error("读取会话标题失败:", error);
  }
}

function insertFileReference(file: FileSearchItem, insert: ComposerPanelSlotProps["insert"]): void {
  insert(serializeFileToken(file.name, file.relativePath));
}

function insertSkillReference(skill: SkillInfo, insert: ComposerPanelSlotProps["insert"]): void {
  insert(`[!${skill.name}](${skill.filePath})`);
}

function handlePanelKeydown(payload: ComposerPanelKeydownPayload): void {
  const panel = payload.type === "mention" ? fileSearchPanel.value : skillSearchPanel.value;
  panel?.handlePanelKeydown(payload.key);
}

function handleSessionTitleUpdated(payload: MessageEventPayload) {
  if (payload.type !== "title_updated" || payload.sessionId !== sessionId.value) return;
  sessionTitleLoadGeneration += 1;
  sessionTitle.value = payload.title;
}

async function decideApproval(decision: ToolApprovalDecision): Promise<void> {
  const approval = currentApproval.value;
  if (!approval) throw new Error("审批请求已失效");
  await resolveApproval(approval.approvalId, decision);
}

async function loadModels(): Promise<void> {
  const generation = ++modelLoadGeneration;
  loadingModels.value = true;
  modelLoadError.value = false;

  try {
    const [userConfig, catalog, configured] = await Promise.all([
      electronAPI.getUserConfig(),
      electronAPI.getProviderCatalog(),
      electronAPI.getConfiguredProviders(),
    ]);
    if (generation !== modelLoadGeneration) return;

    const configuredProviderIds = new Set(configured.providerIds);
    providers.value = catalog.providers.filter(
      (provider) => configuredProviderIds.has(provider.id) && provider.models.length > 0,
    );
    const findAvailableModel = (model: ModelConfig | undefined) =>
      modelOptions.value.find(
        (option) =>
          option.value.providerId === model?.providerId && option.value.modelId === model.modelId,
      )?.value;
    selectedModel.value =
      findAvailableModel(composerPreferences.value.model) ??
      findAvailableModel(userConfig.largeModel) ??
      modelOptions.value[0]?.value;
  } catch (error) {
    if (generation !== modelLoadGeneration) return;
    modelLoadError.value = true;
    console.error("读取模型列表失败:", error);
  } finally {
    if (generation === modelLoadGeneration) loadingModels.value = false;
  }
}

watch([workspaceId, sessionId], () => void loadSessionTitle(), { immediate: true });
watch(
  [approvalMode, selectedModel, reasoningEffort],
  ([nextApprovalMode, nextModel, nextReasoningEffort]) => {
    composerPreferences.value = {
      approvalMode: nextApprovalMode,
      model: nextModel,
      reasoningEffort: nextReasoningEffort,
    };
  },
  { flush: "sync" },
);
watch(
  [workspaceId, sessionId, currentSessionRunning],
  ([nextWorkspaceId, nextSessionId, running]) => {
    if (nextWorkspaceId !== undefined && nextSessionId !== undefined && !running) {
      messageQueue.resume(nextWorkspaceId, nextSessionId);
    }
  },
  { immediate: true },
);

onMounted(() => {
  addEventListener(MESSAGE_EVENT, handleSessionTitleUpdated);
  removeProviderConfigurationListener = onProviderConfigurationChanged(() => void loadModels());
  void loadModels();
});

onBeforeUnmount(() => {
  sessionTitleLoadGeneration += 1;
  modelLoadGeneration += 1;
  removeEventListener(MESSAGE_EVENT, handleSessionTitleUpdated);
  removeProviderConfigurationListener?.();
});

function enqueueMessage(
  currentWorkspaceId: number,
  currentSessionId: string,
  payload: ComposerSubmitPayload,
): void {
  if (!payload.model) return;
  messageQueue.enqueue({
    workspaceId: currentWorkspaceId,
    sessionId: currentSessionId,
    blocked:
      isSessionRunning(currentSessionId) &&
      !messageQueue.isSessionActive(currentWorkspaceId, currentSessionId),
    payload: {
      content: payload.content,
      model: payload.model,
      approvalMode: payload.approvalMode ?? "request-approval",
      reasoningEffort: payload.reasoningEffort,
    },
  });
}

async function createSessionAndEnqueue(
  currentWorkspaceId: number,
  payload: ComposerSubmitPayload,
): Promise<void> {
  creatingSession.value = true;
  try {
    await waitUntilReady();
    const response = await electronAPI.createSession({ workspaceId: currentWorkspaceId });
    const currentSessionId = response.sessionId;
    const navigationFailure = await router.push({
      name: "chat",
      params: { sessionId: currentSessionId },
      query: { workspaceId: String(currentWorkspaceId) },
    });
    if (isNavigationFailure(navigationFailure)) throw navigationFailure;

    await nextTick();
    enqueueMessage(currentWorkspaceId, currentSessionId, payload);
  } catch (error) {
    creationError.value = getErrorMessage(error, "创建会话失败，请重试。");
    console.error("创建会话或打开聊天失败:", error);
  } finally {
    creatingSession.value = false;
  }
}

function sendMessage(payload: ComposerSubmitPayload): void {
  const content = payload.content;
  const model = payload.model;
  const currentWorkspaceId = workspaceId.value;
  const currentSessionId = sessionId.value;
  if (
    !content ||
    !model ||
    !currentWorkspaceId ||
    creatingSession.value ||
    (route.name !== "home" && !currentSessionId)
  ) {
    console.error("发送消息失败: 缺少工作区、会话或模型配置");
    return;
  }

  creationError.value = "";
  if (currentSessionId) {
    enqueueMessage(currentWorkspaceId, currentSessionId, payload);
  } else {
    void createSessionAndEnqueue(currentWorkspaceId, payload);
  }
}

function stopMessage(): void {
  const currentWorkspaceId = workspaceId.value;
  const currentSessionId = sessionId.value;
  if (!currentWorkspaceId || !currentSessionId || !currentSessionStreaming.value) return;
  void messageQueue.stop(currentWorkspaceId, currentSessionId);
}

function openProviderSettings(): void {
  openDialog(
    SettingDialog,
    { initialTab: "providers" },
    {
      contentClass:
        "h-[min(700px,calc(100vh-2rem))] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[min(950px,calc(100vw-2rem))]",
    },
  );
}

function removeQueuedMessage(messageId: string): void {
  const currentWorkspaceId = workspaceId.value;
  const currentSessionId = sessionId.value;
  if (!currentWorkspaceId || !currentSessionId) return;
  messageQueue.remove(currentWorkspaceId, currentSessionId, messageId);
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <BaseHeader>
      <template #left>
        <p class="truncate text-sm font-medium">{{ topBarTitle }}</p>
      </template>
    </BaseHeader>

    <div class="min-h-0 flex-1 overflow-hidden">
      <RouterView v-slot="{ Component }">
        <component :is="Component" :streaming="currentSessionStreaming">
          <QueuedMessageList
            v-if="queuedMessages.length > 0"
            :messages="queuedMessages"
            @remove="removeQueuedMessage"
          />
          <TodoListPanel :items="todoList" />
          <Transition name="approval-panel" mode="out-in">
            <ToolApprovalPanel
              v-if="currentApproval"
              :key="currentApproval.approvalId"
              :request="currentApproval"
              :on-decision="decideApproval"
            />
            <PromptComposer
              v-else
              key="prompt-composer"
              v-model:content="message"
              v-model:approval-mode="approvalMode"
              v-model:model="selectedModel"
              v-model:reasoning-effort="reasoningEffort"
              :approval-options="approvalOptions"
              :models="modelOptions"
              :token-rules="[...defaultComposerTokenRules]"
              :disabled="composerDisabled"
              :submitting="creatingSession"
              :streaming="currentSessionStreaming"
              :stopping="currentSessionStopping"
              @stop="stopMessage"
              @submit="sendMessage"
              @panel-keydown="handlePanelKeydown"
            >
              <template #mention-panel="{ query, insert }">
                <FileSearchPanel
                  ref="fileSearchPanel"
                  :workspace-id="workspaceId"
                  :query="query"
                  @select="insertFileReference($event, insert)"
                />
              </template>
              <template #slash-panel="{ query, insert }">
                <SkillSearchPanel
                  ref="skillSearchPanel"
                  :workspace-id="workspaceId"
                  :query="query"
                  @select="insertSkillReference($event, insert)"
                />
              </template>
            </PromptComposer>
          </Transition>
          <p v-if="loadingModels" class="mt-2 text-sm text-muted-foreground">正在读取模型…</p>
          <p v-else-if="modelLoadError" class="mt-2 text-sm text-destructive">无法读取模型列表</p>
          <p v-else-if="providers.length === 0" class="mt-2 text-sm text-muted-foreground">
            请先连接模型提供商
            <button
              type="button"
              class="ml-1 cursor-pointer text-blue-500 hover:underline focus-visible:underline focus-visible:outline-none"
              @click="openProviderSettings"
            >
              前往设置
            </button>
          </p>
          <p v-if="sendError" class="mt-2 text-sm text-destructive" role="alert">
            {{ sendError }}
          </p>
        </component>
      </RouterView>
    </div>
  </div>
</template>

<style scoped>
.approval-panel-enter-active,
.approval-panel-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.approval-panel-enter-from,
.approval-panel-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}

@media (prefers-reduced-motion: reduce) {
  .approval-panel-enter-active,
  .approval-panel-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
