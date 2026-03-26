<script setup lang="ts">
import type { SendMessage } from "@shared/api";
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { computed, onBeforeMount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import InputGroupText from "@/components/ui/input-group/InputGroupText.vue";
import { Separator } from "@/components/ui/separator";
import { useConfigStore } from "@/stores/config";

const router = useRouter();
const configStore = useConfigStore();
const { modelList, defaultModel } = storeToRefs(configStore);

const message = ref("");
const selectedModelId = ref<string>("");
const showNoModelTip = ref(false);

const hasModels = computed(() => modelList.value.length > 0);

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

function goToSetting() {
  router.push("/setting");
}

const emit = defineEmits<{
  send: [request: SendMessage];
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
  });
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
        <InputGroupText class="ml-auto">52% used</InputGroupText>
        <Separator orientation="vertical" class="!h-4" />
        <InputGroupButton
          :disabled="!message.trim().length"
          variant="default"
          class="rounded-full"
          size="icon-xs"
          @click="handleSend"
        >
          <ArrowUpIcon class="size-4" />
          <span class="sr-only">Send</span>
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  </div>
</template>
