<script setup lang="ts">
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { SendMessage } from "@shared/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@willow/shadcn/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@willow/shadcn/components/ui/input-group";
import { Separator } from "@willow/shadcn/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@willow/shadcn/components/ui/tooltip";
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  GlobeIcon,
  PlusIcon,
  SettingsIcon,
  SquareIcon,
} from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { computed, onBeforeMount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useConfigStore } from "@/stores/config";
import CircularProgress from "../CircularProgress.vue";

interface UsageLike {
  input?: number;
  output?: number;
}

const props = withDefaults(
  defineProps<{
    messages?: AgentMessage[];
    isStreaming?: boolean;
    streamMessage?: AgentMessage | null;
    showUsage?: boolean;
  }>(),
  {
    messages: () => [],
    isStreaming: false,
    streamMessage: null,
    showUsage: true,
  },
);

const router = useRouter();
const configStore = useConfigStore();
const { modelList, defaultModel } = storeToRefs(configStore);

const message = ref("");
const selectedModelId = ref<string>("");
const showNoModelTip = ref(false);
const webSearchEnabled = ref(true);

const hasModels = computed(() => modelList.value.length > 0);
const selectedModel = computed(
  () =>
    modelList.value.find((model) => model.modelId === selectedModelId.value) ?? defaultModel.value,
);
const contextWindow = computed(() => selectedModel.value?.contextWindow ?? 0);

onBeforeMount(async () => {
  if (modelList.value.length === 0) {
    await configStore.fetchModelList();
  }
  if (defaultModel.value) {
    selectedModelId.value = defaultModel.value.modelId;
  }
});

watch(defaultModel, (m) => {
  if (m && !selectedModelId.value) {
    selectedModelId.value = m.modelId;
  }
});

const selectedModelName = computed(() => {
  if (!hasModels.value) return "未配置模型";
  const found = modelList.value.find((m) => m.modelId === selectedModelId.value);
  return found?.name || selectedModelId.value || "选择模型";
});

function getUsage(message: AgentMessage | null | undefined): UsageLike | null {
  if (!message || typeof message !== "object" || !("usage" in message)) {
    return null;
  }
  const usage = (message as AgentMessage & { usage?: UsageLike }).usage;
  if (!usage) {
    return null;
  }
  return usage;
}

function getUsedTokens(message: AgentMessage | null | undefined) {
  const usage = getUsage(message);
  return (usage?.input ?? 0) + (usage?.output ?? 0);
}

function formatTokenCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}K`;
  return `${Math.round(count / 1000)}K`;
}

const historyUsedTokens = computed(() => {
  return props.messages.reduce((total, message) => {
    return total + getUsedTokens(message);
  }, 0);
});

const streamUsedTokens = computed(() => {
  if (!props.isStreaming || !props.streamMessage) {
    return 0;
  }
  return getUsedTokens(props.streamMessage);
});

const usedTokens = computed(() => {
  return historyUsedTokens.value + streamUsedTokens.value;
});

const usagePercent = computed(() => {
  if (!contextWindow.value) {
    return 0;
  }
  return (usedTokens.value / contextWindow.value) * 100;
});

const usagePercentText = computed(() => `${usagePercent.value.toFixed(1)}%`);
const usedTokensText = computed(() => formatTokenCount(usedTokens.value));
const contextWindowText = computed(() => formatTokenCount(contextWindow.value));
const shouldShowUsage = computed(
  () => hasModels.value && contextWindow.value > 0 && props.showUsage,
);

function goToSetting() {
  router.push("/setting");
}

const emit = defineEmits<{
  send: [request: SendMessage];
  stop: [];
}>();

function handleSend() {
  if (!hasModels.value || !selectedModelId.value) {
    showNoModelTip.value = true;
    setTimeout(() => {
      showNoModelTip.value = false;
    }, 3000);
    return;
  }
  const msg = message.value.trim();
  message.value = "";
  emit("send", {
    message: msg,
    modelId: selectedModelId.value,
    webSearchEnabled: webSearchEnabled.value,
  });
}

function handleAction() {
  if (props.isStreaming) {
    emit("stop");
    return;
  }
  handleSend();
}
</script>
<template>
  <div class="relative">
    <div
      v-if="showNoModelTip"
      class="absolute -top-10 left-1/2 z-10 -translate-x-1/2 rounded-md bg-destructive px-3 py-1.5 text-xs text-white shadow-md"
    >
      请先前往
      <span class="cursor-pointer underline" @click="goToSetting">设置</span>
      配置模型
    </div>
    <InputGroup class="!shadow-[none]">
      <InputGroupTextarea v-model="message" placeholder="Ask, Search or Chat..." />
      <InputGroupAddon align="block-end">
        <InputGroupButton variant="outline" class="rounded-full" size="icon-xs">
          <PlusIcon class="size-4" />
        </InputGroupButton>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <InputGroupButton
                :variant="webSearchEnabled ? 'default' : 'outline'"
                class="rounded-full"
                size="icon-xs"
                @click="webSearchEnabled = !webSearchEnabled"
              >
                <GlobeIcon class="size-4" />
              </InputGroupButton>
            </TooltipTrigger>
            <TooltipContent side="top">
              {{ webSearchEnabled ? "关闭网络搜索" : "开启网络搜索" }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <InputGroupButton variant="ghost" class="gap-1">
              <span class="max-w-[120px] truncate text-xs">{{ selectedModelName }}</span>
              <ChevronsUpDownIcon class="size-3 opacity-50" />
            </InputGroupButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" class="[--radius:0.95rem]">
            <template v-if="hasModels">
              <DropdownMenuItem
                v-for="model in modelList"
                :key="model.modelId"
                class="gap-2"
                @click="selectedModelId = model.modelId"
              >
                <CheckIcon
                  class="size-3.5"
                  :class="selectedModelId === model.modelId ? 'opacity-100' : 'opacity-0'"
                />
                <span>{{ model.name }}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </template>
            <template v-else>
              <div class="px-3 py-2 text-center text-xs text-muted-foreground">暂无可用模型</div>
              <DropdownMenuSeparator />
            </template>
            <DropdownMenuItem class="gap-2" @click="goToSetting">
              <SettingsIcon class="size-3.5" />
              <span>前往设置</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div class="ml-auto"></div>
        <TooltipProvider v-if="shouldShowUsage">
          <Tooltip>
            <TooltipTrigger as-child>
              <div class="flex cursor-pointer items-center p-1">
                <CircularProgress class="cursor-pointer" :size="16" :progress="usagePercent" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" align="center">
              <div>{{ usagePercentText }} · {{ usedTokensText }} / {{ contextWindowText }}</div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Separator v-if="shouldShowUsage" orientation="vertical" class="!h-4" />
        <InputGroupButton
          :disabled="!props.isStreaming && !message.trim().length"
          variant="default"
          class="rounded-full"
          size="icon-xs"
          @click="handleAction"
        >
          <SquareIcon v-if="props.isStreaming" class="size-3.5 fill-current" />
          <ArrowUpIcon v-else class="size-4" />
          <span class="sr-only">{{ props.isStreaming ? "Stop" : "Send" }}</span>
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  </div>
</template>
