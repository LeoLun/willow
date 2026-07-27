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
import BaseHeader from "@/components/layout/BaseHeader.vue";
import {
  defaultComposerTokenRules,
  PromptComposer,
  serializeFileToken,
  type ComposerModelOption,
  type ComposerOption,
  type ComposerPanelSlotProps,
  type ComposerSubmitPayload,
} from "@/components/prompt-composer";
import FileSearchPanel from "@/components/prompt-composer/FileSearchPanel.vue";
import SkillSearchPanel from "@/components/prompt-composer/SkillSearchPanel.vue";
import ToolApprovalPanel from "@/components/tool/ToolApprovalPanel.vue";
import { useEventBus } from "@/composables/useEventBus";
import { useToolApproval } from "@/composables/useToolApproval";
import { electronAPI } from "@/lib/ipc";

const route = useRoute();
const router = useRouter();
const { addEventListener, removeEventListener, waitUntilReady } = useEventBus();
const message = ref("");
const sending = ref(false);
const sendError = ref("");
const sessionTitle = ref("");
const loadingModels = ref(true);
const modelLoadError = ref(false);
const providers = shallowRef<ProviderInfo[]>([]);
const selectedModel = shallowRef<ModelConfig>();
const approvalMode = ref<PermissionMode>("request-approval");
const reasoningEffort = ref<string>();

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
const { currentApproval, resolveApproval } = useToolApproval(workspaceId, sessionId);

const modelOptions = computed<ComposerModelOption[]>(() =>
  providers.value.flatMap((provider) =>
    provider.models.map((providerModel) => {
      const reasoningEfforts = providerModel.thinkingLevels.map((level) => ({
        value: level,
        label: level,
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
    (route.name !== "home" && sessionId.value === undefined),
);
const topBarTitle = computed(() =>
  route.name === "chat" ? sessionTitle.value.trim() || "新对话" : "",
);

let sessionTitleLoadGeneration = 0;

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

watch([workspaceId, sessionId], () => void loadSessionTitle(), { immediate: true });

onMounted(async () => {
  addEventListener(MESSAGE_EVENT, handleSessionTitleUpdated);

  try {
    const [userConfig, catalog, configured] = await Promise.all([
      electronAPI.getUserConfig(),
      electronAPI.getProviderCatalog(),
      electronAPI.getConfiguredProviders(),
    ]);
    const configuredProviderIds = new Set(configured.providerIds);
    providers.value = catalog.providers.filter(
      (provider) => configuredProviderIds.has(provider.id) && provider.models.length > 0,
    );
    const configuredModel = userConfig.largeModel;
    const hasConfiguredModel = providers.value.some(
      (provider) =>
        provider.id === configuredModel?.providerId &&
        provider.models.some((model) => model.id === configuredModel.modelId),
    );
    selectedModel.value = hasConfiguredModel ? configuredModel : modelOptions.value[0]?.value;
  } catch (error) {
    modelLoadError.value = true;
    console.error("读取模型列表失败:", error);
  } finally {
    loadingModels.value = false;
  }
});

onBeforeUnmount(() => {
  sessionTitleLoadGeneration += 1;
  removeEventListener(MESSAGE_EVENT, handleSessionTitleUpdated);
});

async function sendMessage(payload: ComposerSubmitPayload) {
  const content = payload.content;
  const model = payload.model;
  const currentWorkspaceId = workspaceId.value;
  let currentSessionId = sessionId.value;
  if (
    !content ||
    !model ||
    !currentWorkspaceId ||
    sending.value ||
    (route.name !== "home" && !currentSessionId)
  ) {
    console.error("发送消息失败: 缺少工作区、会话或模型配置");
    return;
  }

  sending.value = true;
  sendError.value = "";
  try {
    await waitUntilReady();

    if (!currentSessionId) {
      const response = await electronAPI.createSession({ workspaceId: currentWorkspaceId });
      currentSessionId = response.sessionId;
      const navigationFailure = await router.push({
        name: "chat",
        params: { sessionId: currentSessionId },
        query: { workspaceId: String(currentWorkspaceId) },
      });
      if (isNavigationFailure(navigationFailure)) {
        throw navigationFailure;
      }

      await nextTick();
    }

    const response = await electronAPI.sendMessage({
      workspaceId: currentWorkspaceId,
      sessionId: currentSessionId,
      content,
      model,
      approvalMode: payload.approvalMode ?? "request-approval",
    });
    console.log("[SEND_MESSAGE]", response.message);
  } catch (error) {
    sendError.value = getErrorMessage(error, "发送消息失败，请重试。");
    console.error("创建会话、打开聊天或发送消息失败:", error);
  } finally {
    sending.value = false;
  }
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
        <component :is="Component">
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
              :submitting="sending"
              @submit="sendMessage"
            >
              <template #mention-panel="{ query, insert }">
                <FileSearchPanel
                  :workspace-id="workspaceId"
                  :query="query"
                  @select="insertFileReference($event, insert)"
                />
              </template>
              <template #slash-panel="{ query, insert }">
                <SkillSearchPanel
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
