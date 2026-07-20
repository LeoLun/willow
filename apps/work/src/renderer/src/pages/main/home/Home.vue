<script setup lang="ts">
import type { ModelConfig, UserConfigInfo } from "@shared/api";
import {
  InputGroup,
  InputGroupTextarea,
  InputGroupText,
  InputGroupAddon,
  InputGroupButton,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Separator,
} from "@willow/shadcn";
import { SquareDashed, PlusIcon, ArrowUpIcon } from "lucide-vue-next";
import { computed, onMounted, ref, shallowRef } from "vue";
import { isNavigationFailure, useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { electronAPI } from "@/lib/ipc";
import { usePendingChatStore } from "@/stores/pending-chat.store";

const route = useRoute();
const router = useRouter();
const pendingChatStore = usePendingChatStore();
const message = ref("");
const sending = ref(false);
const userConfig = shallowRef<UserConfigInfo>({});
const selectedModelKind = ref<"largeModel" | "smallModel">("largeModel");

const workspaceId = computed(() => {
  const value = Number(route.query.workspaceId);
  return Number.isInteger(value) && value > 0 ? value : undefined;
});

const selectedModel = computed<ModelConfig | undefined>(
  () => userConfig.value[selectedModelKind.value],
);
const selectedModelLabel = computed(
  () =>
    selectedModel.value?.modelId ??
    (selectedModelKind.value === "largeModel" ? "大模型" : "小模型"),
);
const canSend = computed(
  () =>
    message.value.trim() !== "" &&
    !sending.value &&
    workspaceId.value !== undefined &&
    selectedModel.value !== undefined,
);

function selectModel(kind: "largeModel" | "smallModel") {
  if (userConfig.value[kind]) {
    selectedModelKind.value = kind;
  }
}

onMounted(async () => {
  try {
    userConfig.value = await electronAPI.getUserConfig();
  } catch (error) {
    console.error("读取模型配置失败:", error);
  }
});

async function sendMessage() {
  const content = message.value.trim();
  const model = selectedModel.value;
  const currentWorkspaceId = workspaceId.value;
  if (!content || !model || !currentWorkspaceId || sending.value) {
    console.error("创建会话失败: 缺少工作区或模型配置");
    return;
  }

  sending.value = true;
  let createdSessionId: string | undefined;
  try {
    const response = await electronAPI.createSession({ workspaceId: currentWorkspaceId });
    createdSessionId = response.sessionId;
    pendingChatStore.stage({
      sessionId: createdSessionId,
      workspaceId: currentWorkspaceId,
      content,
      model,
    });

    const navigationFailure = await router.push({
      name: "chat",
      params: { sessionId: createdSessionId },
      query: { workspaceId: String(currentWorkspaceId) },
    });
    if (isNavigationFailure(navigationFailure)) {
      throw navigationFailure;
    }
    message.value = "";
  } catch (error) {
    if (createdSessionId) pendingChatStore.clear(createdSessionId);
    console.error("创建会话或打开聊天失败:", error);
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-full flex-col items-center justify-center p-8">
    <div class="max-w-sm text-center">
      <p class="text-sm font-medium text-foreground">Text Edit</p>
      <p class="mt-1 text-sm text-muted-foreground">
        Select an item from the sidebar to start exploring.
      </p>
      <div class="mt-2 flex flex-col items-center">
        <div class="flex items-center gap-1">
          <Button shape="circular" aria-label="Action">
            <SquareDashed />
          </Button>
          <Button shape="capsule" aria-label="Action">
            <SquareDashed />
          </Button>
          <Button variant="borderless" shape="capsule">
            <SquareDashed />
          </Button>

          <ButtonGroup shape="capsule" aria-label="Actions">
            <Button aria-label="First">
              <SquareDashed />
            </Button>
            <Button aria-label="Second">
              <SquareDashed />
            </Button>
            <Button aria-label="Third">
              <SquareDashed />
            </Button>
          </ButtonGroup>
        </div>

        <ButtonGroup shape="circular" aria-label="Actions">
          <Button aria-label="First">
            <SquareDashed />
          </Button>
          <Button aria-label="Second">
            <SquareDashed />
          </Button>
          <Button aria-label="Third">
            <SquareDashed />
          </Button>
        </ButtonGroup>
      </div>
    </div>
    <InputGroup>
      <InputGroupTextarea placeholder="Ask, Search or Chat..." v-model="message" />
      <InputGroupAddon align="block-end">
        <InputGroupButton variant="outline" class="rounded-full" size="icon-xs">
          <PlusIcon class="size-4" />
        </InputGroupButton>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <InputGroupButton variant="ghost">{{ selectedModelLabel }}</InputGroupButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" class="[--radius:0.95rem]">
            <DropdownMenuItem
              :disabled="!userConfig.largeModel"
              @select="selectModel('largeModel')"
            >
              大模型<span v-if="userConfig.largeModel"> · {{ userConfig.largeModel.modelId }}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              :disabled="!userConfig.smallModel"
              @select="selectModel('smallModel')"
            >
              小模型<span v-if="userConfig.smallModel"> · {{ userConfig.smallModel.modelId }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <InputGroupText class="ml-auto"> 52% used </InputGroupText>
        <Separator orientation="vertical" class="!h-4" />
        <div>{{ canSend }}</div>
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
  </div>
</template>
