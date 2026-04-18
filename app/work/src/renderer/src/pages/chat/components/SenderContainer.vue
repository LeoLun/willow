<script setup lang="ts">
import type { SendMessage, SkillSummary } from "@shared/api";
import { Sender } from "@willow/sender";
import { storeToRefs } from "pinia";
import { onBeforeMount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { electronAPI } from "@/lib/ipc";
import { useConfigStore } from "@/stores/config";

const props = withDefaults(
  defineProps<{
    messages?: { usage?: { input?: number; output?: number } }[];
    isStreaming?: boolean;
    streamMessage?: { usage?: { input?: number; output?: number } } | null;
    showUsage?: boolean;
    workspaceId?: number;
  }>(),
  {
    messages: () => [],
    isStreaming: false,
    streamMessage: null,
    showUsage: true,
    workspaceId: 0,
  },
);

const emit = defineEmits<{
  send: [request: SendMessage];
  stop: [];
}>();

const router = useRouter();
const configStore = useConfigStore();
const { modelList, defaultModel } = storeToRefs(configStore);

const skills = ref<SkillSummary[]>([]);
const isSkillsLoading = ref(false);
const skillsErrorMessage = ref("");

onBeforeMount(async () => {
  if (modelList.value.length === 0) {
    await configStore.fetchModelList();
  }
});

watch(
  () => props.workspaceId,
  async () => {
    await loadAvailableSkills();
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

function handleOpenSettings() {
  router.push("/setting");
}

function handleSend(request: SendMessage) {
  emit("send", request);
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
    :skills="skills"
    :skills-loading="isSkillsLoading"
    :skills-error-message="skillsErrorMessage"
    @send="handleSend"
    @stop="emit('stop')"
    @open-settings="handleOpenSettings"
  />
</template>
