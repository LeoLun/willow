<script setup lang="ts">
import type {
  AskUserAnswers,
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
import { Button } from "@willow/shadcn/components/ui/button";
import {
  FolderOpenIcon,
  PanelRightIcon,
  ShieldCheckIcon,
  ShieldQuestionIcon,
  UserCheckIcon,
} from "lucide-vue-next";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useId,
  watch,
  type StyleValue,
} from "vue";
import { isNavigationFailure, useRoute, useRouter } from "vue-router";
import { useDialog } from "@/components/dialog";
import SettingDialog from "@/components/dialog/setting/Setting.vue";
import BaseHeader from "@/components/layout/BaseHeader.vue";
import {
  defaultComposerTokenRules,
  PromptComposer,
  serializeFileToken,
  type ComposerHandle,
  type ComposerModelOption,
  type ComposerOption,
  type ComposerPanelSlotProps,
  type ComposerPanelKeydownPayload,
  type ComposerPanelNavigationHandle,
  type ComposerPromptTemplate,
  type ComposerSubmitPayload,
} from "@/components/prompt-composer";
import FileSearchPanel from "@/components/prompt-composer/FileSearchPanel.vue";
import QueuedMessageList from "@/components/prompt-composer/QueuedMessageList.vue";
import SkillSearchPanel from "@/components/prompt-composer/SkillSearchPanel.vue";
import { RightSidebar } from "@/components/right-sidebar";
import { TodoListPanel } from "@/components/todo-list";
import ToolApprovalPanel from "@/components/tool/ToolApprovalPanel.vue";
import UserQuestionPanel from "@/components/tool/UserQuestionPanel.vue";
import { useComposerPreferences } from "@/composables/useComposerPreferences";
import { useEventBus } from "@/composables/useEventBus";
import { useMessageStatus, useSessionMessages } from "@/composables/useMessage";
import { useMessageQueue } from "@/composables/useMessageQueue";
import { useToolApproval } from "@/composables/useToolApproval";
import { useUserQuestion } from "@/composables/useUserQuestion";
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
const promptComposer = shallowRef<ComposerHandle>();
const contentLayout = shallowRef<HTMLElement>();

const workspaceId = computed(() => {
  const value = Number(route.query.workspaceId);
  return Number.isInteger(value) && value > 0 ? value : undefined;
});

const sessionId = computed(() => {
  const value = route.params.sessionId;
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
});

const RIGHT_SIDEBAR_OPEN_STORAGE_KEY_PREFIX = "willow:chat-right-sidebar-open";
const RIGHT_SIDEBAR_WIDTH_STORAGE_KEY = "willow:chat-right-sidebar-width";
const DEFAULT_RIGHT_SIDEBAR_WIDTH = 320;
const MIN_RIGHT_SIDEBAR_WIDTH = 350;
const MIN_MAIN_PANE_WIDTH = 500;
const RESIZE_HANDLE_WIDTH = 8;
const KEYBOARD_RESIZE_STEP = 16;

function getRightSidebarOpenStorageKey(currentSessionId: string | undefined): string {
  return `${RIGHT_SIDEBAR_OPEN_STORAGE_KEY_PREFIX}:${currentSessionId ?? "home"}`;
}

function loadRightSidebarOpen(currentSessionId = sessionId.value): boolean {
  try {
    return localStorage.getItem(getRightSidebarOpenStorageKey(currentSessionId)) === "true";
  } catch {
    return false;
  }
}

function loadRightSidebarWidth(): number {
  try {
    const width = Number(localStorage.getItem(RIGHT_SIDEBAR_WIDTH_STORAGE_KEY));
    return Number.isFinite(width) && width >= MIN_RIGHT_SIDEBAR_WIDTH
      ? width
      : DEFAULT_RIGHT_SIDEBAR_WIDTH;
  } catch {
    return DEFAULT_RIGHT_SIDEBAR_WIDTH;
  }
}

const rightSidebarOpen = ref(loadRightSidebarOpen());
const savedRightSidebarWidth = ref(loadRightSidebarWidth());
const contentLayoutWidth = ref(0);
const preferredMainPaneWidth = ref<number>();
const resizingRightSidebar = ref(false);
const rightSidebarId = useId();

let contentResizeObserver: ResizeObserver | undefined;
let previousBodyUserSelect = "";
let resizeStartPointerX = 0;
let resizeStartMainPaneWidth = 0;

const approvalOptions: ComposerOption[] = [
  { value: "request-approval", label: "请求批准", icon: ShieldQuestionIcon },
  { value: "delegate-approval", label: "替我审批", icon: UserCheckIcon },
  { value: "full-access", label: "完全访问权限", icon: ShieldCheckIcon },
];
const thinkingLevelOrder: ThinkingLevel[] = ["minimal", "low", "medium", "high", "xhigh", "max"];

const { todoList } = useSessionMessages(workspaceId, sessionId);
const { currentApproval, resolveApproval } = useToolApproval(workspaceId, sessionId);
const { currentQuestion, resolveQuestion } = useUserQuestion(workspaceId, sessionId);
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
const mainPaneWidth = computed(() => {
  const layoutWidth = contentLayoutWidth.value;
  const preferredWidth =
    preferredMainPaneWidth.value ??
    layoutWidth - savedRightSidebarWidth.value - RESIZE_HANDLE_WIDTH;
  const maximumWidth = layoutWidth - MIN_RIGHT_SIDEBAR_WIDTH - RESIZE_HANDLE_WIDTH;
  return Math.max(MIN_MAIN_PANE_WIDTH, Math.min(preferredWidth, maximumWidth));
});
const rightSidebarWidth = computed(() =>
  Math.max(0, contentLayoutWidth.value - mainPaneWidth.value - RESIZE_HANDLE_WIDTH),
);
const contentLayoutStyle = computed<StyleValue>(() =>
  rightSidebarOpen.value
    ? {
        gridTemplateColumns: `${mainPaneWidth.value}px ${RESIZE_HANDLE_WIDTH}px minmax(0, 1fr)`,
      }
    : { gridTemplateColumns: "minmax(0, 1fr)" },
);

let sessionTitleLoadGeneration = 0;
let modelLoadGeneration = 0;
let removeProviderConfigurationListener: (() => void) | undefined;

function measureContentLayout(): number {
  const width = contentLayout.value?.getBoundingClientRect().width ?? 0;
  contentLayoutWidth.value = width;
  return width;
}

function initializeMainPaneWidth(): void {
  const layoutWidth = measureContentLayout();
  preferredMainPaneWidth.value = Math.max(
    MIN_MAIN_PANE_WIDTH,
    layoutWidth - savedRightSidebarWidth.value - RESIZE_HANDLE_WIDTH,
  );
}

function saveRightSidebarOpen(): void {
  try {
    localStorage.setItem(
      getRightSidebarOpenStorageKey(sessionId.value),
      String(rightSidebarOpen.value),
    );
  } catch {
    // Persistence is optional when storage is unavailable.
  }
}

function saveRightSidebarWidth(): void {
  const width = Math.max(MIN_RIGHT_SIDEBAR_WIDTH, Math.round(rightSidebarWidth.value));
  savedRightSidebarWidth.value = width;
  try {
    localStorage.setItem(RIGHT_SIDEBAR_WIDTH_STORAGE_KEY, String(width));
  } catch {
    // Persistence is optional when storage is unavailable.
  }
}

function toggleRightSidebar(): void {
  rightSidebarOpen.value = !rightSidebarOpen.value;
  saveRightSidebarOpen();
  if (rightSidebarOpen.value) initializeMainPaneWidth();
  else preferredMainPaneWidth.value = undefined;
}

async function openCurrentWorkspace(): Promise<void> {
  const currentWorkspaceId = workspaceId.value;
  if (currentWorkspaceId === undefined) return;
  await electronAPI.openWorkspaceDirectory({ workspaceId: currentWorkspaceId });
}

function clampMainPaneWidth(width: number): number {
  const maximumWidth = contentLayoutWidth.value - MIN_RIGHT_SIDEBAR_WIDTH - RESIZE_HANDLE_WIDTH;
  return Math.max(MIN_MAIN_PANE_WIDTH, Math.min(width, maximumWidth));
}

function resizeMainPaneFromPointer(event: PointerEvent): void {
  const pointerDelta = event.clientX - resizeStartPointerX;
  preferredMainPaneWidth.value = clampMainPaneWidth(resizeStartMainPaneWidth + pointerDelta);
}

function stopRightSidebarResize(): void {
  if (!resizingRightSidebar.value) return;
  resizingRightSidebar.value = false;
  saveRightSidebarWidth();
  window.removeEventListener("pointermove", resizeMainPaneFromPointer);
  window.removeEventListener("pointerup", stopRightSidebarResize);
  window.removeEventListener("pointercancel", stopRightSidebarResize);
  document.body.style.userSelect = previousBodyUserSelect;
}

function startRightSidebarResize(event: PointerEvent): void {
  if (event.button !== 0 || resizingRightSidebar.value) return;
  event.preventDefault();
  previousBodyUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = "none";
  resizeStartPointerX = event.clientX;
  resizeStartMainPaneWidth = mainPaneWidth.value;
  resizingRightSidebar.value = true;
  window.addEventListener("pointermove", resizeMainPaneFromPointer);
  window.addEventListener("pointerup", stopRightSidebarResize);
  window.addEventListener("pointercancel", stopRightSidebarResize);
}

function handleResizeHandleKeydown(event: KeyboardEvent): void {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const delta = event.key === "ArrowLeft" ? -KEYBOARD_RESIZE_STEP : KEYBOARD_RESIZE_STEP;
  preferredMainPaneWidth.value = clampMainPaneWidth(mainPaneWidth.value + delta);
  saveRightSidebarWidth();
}

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

async function replaceWithSkillReference(
  skill: SkillInfo,
  template?: ComposerPromptTemplate,
): Promise<void> {
  const value = `[!${skill.name}](${skill.filePath})`;
  message.value = "";
  await nextTick();
  if (template) {
    await promptComposer.value?.loadTemplateAndFocus(template);
    return;
  }
  message.value = value;
  await nextTick();
  await promptComposer.value?.replaceContentAndFocus(value);
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

async function answerQuestion(answers?: AskUserAnswers): Promise<void> {
  const question = currentQuestion.value;
  if (!question) throw new Error("问题请求已失效");
  await resolveQuestion(question.requestId, answers);
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
watch(sessionId, (nextSessionId) => {
  rightSidebarOpen.value = loadRightSidebarOpen(nextSessionId);
  if (rightSidebarOpen.value) initializeMainPaneWidth();
  else preferredMainPaneWidth.value = undefined;
});
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
  measureContentLayout();
  if (rightSidebarOpen.value) initializeMainPaneWidth();
  if (contentLayout.value && typeof ResizeObserver !== "undefined") {
    contentResizeObserver = new ResizeObserver(([entry]) => {
      if (entry) contentLayoutWidth.value = entry.contentRect.width;
    });
    contentResizeObserver.observe(contentLayout.value);
  }
  void loadModels();
});

onBeforeUnmount(() => {
  sessionTitleLoadGeneration += 1;
  modelLoadGeneration += 1;
  stopRightSidebarResize();
  contentResizeObserver?.disconnect();
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
      attachments: payload.attachments,
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
  const hasAttachments = payload.attachments.length > 0;
  const model = payload.model;
  const currentWorkspaceId = workspaceId.value;
  const currentSessionId = sessionId.value;
  if (
    (!content && !hasAttachments) ||
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
  <div
    ref="contentLayout"
    class="grid h-full min-h-0 overflow-hidden"
    data-slot="chat-content-layout"
    :style="contentLayoutStyle"
  >
    <Button
      class="no-drag-region absolute top-[12px] right-[12px] z-50"
      variant="ghost"
      size="icon-sm"
      :pressed="rightSidebarOpen"
      :aria-controls="rightSidebarId"
      :aria-expanded="rightSidebarOpen"
      aria-label="切换右侧边栏"
      @click="toggleRightSidebar"
    >
      <PanelRightIcon />
    </Button>

    <div class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" data-slot="chat-main-pane">
      <BaseHeader :class="rightSidebarOpen ? 'mr-[0px]' : 'mr-[48px] pr-0'">
        <template #left>
          <p class="truncate text-sm font-medium">{{ topBarTitle }}</p>
        </template>
        <template #right>
          <Button
            variant="ghost"
            size="icon-sm"
            :disabled="workspaceId === undefined"
            aria-label="打开当前工作空间"
            @click="openCurrentWorkspace"
          >
            <FolderOpenIcon />
          </Button>
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
              <UserQuestionPanel
                v-if="currentQuestion"
                :key="currentQuestion.requestId"
                :request="currentQuestion"
                :on-submit="answerQuestion"
              />
              <ToolApprovalPanel
                v-else-if="currentApproval"
                :key="currentApproval.approvalId"
                :request="currentApproval"
                :on-decision="decideApproval"
              />
              <PromptComposer
                v-else
                ref="promptComposer"
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

    <template v-if="rightSidebarOpen">
      <div
        class="relative z-20 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border hover:after:bg-ring focus-visible:after:w-0.5 focus-visible:after:bg-ring"
        :class="{ 'after:bg-ring': resizingRightSidebar }"
        data-slot="chat-right-sidebar-resize-handle"
        role="separator"
        aria-label="调整右侧边栏宽度"
        aria-orientation="vertical"
        :aria-controls="rightSidebarId"
        :aria-valuemin="MIN_RIGHT_SIDEBAR_WIDTH"
        :aria-valuemax="
          Math.max(
            MIN_RIGHT_SIDEBAR_WIDTH,
            contentLayoutWidth - MIN_MAIN_PANE_WIDTH - RESIZE_HANDLE_WIDTH,
          )
        "
        :aria-valuenow="Math.round(rightSidebarWidth)"
        tabindex="0"
        @pointerdown="startRightSidebarResize"
        @keydown="handleResizeHandleKeydown"
      />
    </template>
    <RightSidebar
      v-show="rightSidebarOpen"
      :id="rightSidebarId"
      :workspace-id="workspaceId"
      @select-skill="replaceWithSkillReference"
    />
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
