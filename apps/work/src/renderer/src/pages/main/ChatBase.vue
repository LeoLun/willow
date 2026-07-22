<script setup lang="ts">
import type { ModelConfig, ProviderInfo } from "@shared/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@willow/shadcn/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from "@willow/shadcn/components/ui/input-group";
import { Separator } from "@willow/shadcn/components/ui/separator";
import { ArrowUpIcon, CheckIcon, PlusIcon } from "lucide-vue-next";
import { computed, nextTick, onMounted, ref, shallowRef } from "vue";
import { isNavigationFailure, useRoute, useRouter } from "vue-router";
import { useEventBus } from "@/composables/useEventBus";
import { electronAPI } from "@/lib/ipc";

const route = useRoute();
const router = useRouter();
const { waitUntilReady } = useEventBus();
const message = ref("");
const sending = ref(false);
const sendError = ref("");
const loadingModels = ref(true);
const modelLoadError = ref(false);
const providers = shallowRef<ProviderInfo[]>([]);
const selectedModel = shallowRef<ModelConfig>();

const workspaceId = computed(() => {
  const value = Number(route.query.workspaceId);
  return Number.isInteger(value) && value > 0 ? value : undefined;
});

const sessionId = computed(() => {
  const value = route.params.sessionId;
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
});

const selectedModelValue = computed(() =>
  selectedModel.value
    ? JSON.stringify([selectedModel.value.providerId, selectedModel.value.modelId])
    : undefined,
);
const selectedModelLabel = computed(() => {
  const model = selectedModel.value;
  if (!model) return "大模型";

  return (
    providers.value
      .find((provider) => provider.id === model.providerId)
      ?.models.find((candidate) => candidate.id === model.modelId)?.name ?? model.modelId
  );
});
const canSend = computed(
  () =>
    message.value.trim() !== "" &&
    !sending.value &&
    workspaceId.value !== undefined &&
    selectedModel.value !== undefined &&
    (route.name === "home" || sessionId.value !== undefined),
);

function selectModel(value: unknown) {
  if (typeof value !== "string") return;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "string" &&
      typeof parsed[1] === "string"
    ) {
      selectedModel.value = { providerId: parsed[0], modelId: parsed[1] };
    }
  } catch {
    // Model values are generated from the local provider catalog.
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

onMounted(async () => {
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
    selectedModel.value = userConfig.largeModel;
  } catch (error) {
    modelLoadError.value = true;
    console.error("读取模型列表失败:", error);
  } finally {
    loadingModels.value = false;
  }
});

async function sendMessage() {
  const content = message.value.trim();
  const model = selectedModel.value;
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
    });
    console.log("[SEND_MESSAGE]", response.message);
    if (message.value.trim() === content) {
      message.value = "";
    }
  } catch (error) {
    sendError.value = getErrorMessage(error, "发送消息失败，请重试。");
    console.error("创建会话、打开聊天或发送消息失败:", error);
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <RouterView v-slot="{ Component }">
    <component :is="Component">
      <InputGroup>
        <InputGroupTextarea v-model="message" placeholder="Ask, Search or Chat..." />
        <InputGroupAddon align="block-end">
          <InputGroupButton variant="outline" class="rounded-full" size="icon-xs">
            <PlusIcon class="size-4" />
          </InputGroupButton>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <InputGroupButton variant="ghost">{{ selectedModelLabel }}</InputGroupButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" class="w-64 [--radius:0.95rem]">
              <DropdownMenuLabel v-if="loadingModels" class="text-muted-foreground">
                正在读取模型…
              </DropdownMenuLabel>
              <DropdownMenuLabel v-else-if="modelLoadError" class="text-destructive">
                无法读取模型列表
              </DropdownMenuLabel>
              <DropdownMenuLabel v-else-if="providers.length === 0" class="text-muted-foreground">
                请先连接模型提供商
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                v-else
                :model-value="selectedModelValue"
                @update:model-value="selectModel"
              >
                <template v-for="(provider, providerIndex) in providers" :key="provider.id">
                  <DropdownMenuSeparator v-if="providerIndex > 0" />
                  <DropdownMenuLabel class="text-muted-foreground">
                    {{ provider.name }}
                  </DropdownMenuLabel>
                  <DropdownMenuRadioItem
                    v-for="model in provider.models"
                    :key="`${provider.id}:${model.id}`"
                    :value="JSON.stringify([provider.id, model.id])"
                    class="pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto"
                  >
                    {{ model.name }}
                    <template #indicator-icon>
                      <CheckIcon class="size-4" />
                    </template>
                  </DropdownMenuRadioItem>
                </template>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <InputGroupText class="ml-auto">52% used</InputGroupText>
          <Separator orientation="vertical" class="!h-4" />
          <InputGroupButton
            variant="default"
            class="rounded-full"
            size="icon-xs"
            :disabled="!canSend"
            @click="sendMessage"
          >
            <ArrowUpIcon class="size-4" />
            <span class="sr-only">Send</span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <p v-if="sendError" class="mt-2 text-sm text-destructive" role="alert">
        {{ sendError }}
      </p>
    </component>
  </RouterView>
</template>
