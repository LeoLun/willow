<script setup lang="ts">
import { computed, onBeforeMount } from "vue";
import { useRouter } from "vue-router";
import { useDialog } from "@/layout/dialog";
import { CreateWorkspace } from "@/layout/dialog/create-workspace";
import { useWorkspaceStore } from "@/stores/workspace";
import SenderContainer from "../components/SenderContainer.vue";
import WelcomeView from "../session/components/WelcomeView.vue";

const props = withDefaults(
  defineProps<{
    messages?: any[];
    isStreaming?: boolean;
    workspaceId?: number;
    chatScope?: "conversation" | "workspace";
  }>(),
  {
    messages: () => [],
    isStreaming: false,
    workspaceId: 0,
    chatScope: "workspace",
  },
);

const emit = defineEmits<{
  (e: "send", request: any): void;
  (e: "stop"): void;
}>();

const router = useRouter();
const workspaceStore = useWorkspaceStore();
const { openDialog } = useDialog();

const workspace = computed(() => {
  return workspaceStore.workspaceList.find(
    (workspace) => workspace.id === Number(props.workspaceId),
  );
});

function handleCreateWorkspace() {
  openDialog(CreateWorkspace, {
    onCreated: () => workspaceStore.fetchWorkspaceList(),
  });
}

function handleGoToSettings() {
  router.push("/setting/configuration");
}

function handleSelectWorkspace(id: number) {
  if (id === -1) {
    const conversationWorkspace = workspaceStore.workspaceList.find(
      (w) => w.kind === "conversation",
    );
    if (conversationWorkspace) {
      void router.push(`/?workspaceId=${conversationWorkspace.id}`);
    } else {
      void router.push("/conversation");
    }
  } else {
    void router.push(`/?workspaceId=${id}`);
  }
}

onBeforeMount(async () => {
  await workspaceStore.fetchWorkspaceList();
});
</script>

<template>
  <WelcomeView
    :current-workspace-name="workspace?.name"
    :chat-scope="props.chatScope"
    :workspaces="workspaceStore.projectWorkspaceList"
    @create-workspace="handleCreateWorkspace"
    @go-to-settings="handleGoToSettings"
    @select-workspace="handleSelectWorkspace"
    class="w-full flex-1"
  >
    <template #sender>
      <SenderContainer
        :messages="props.messages"
        :is-streaming="props.isStreaming"
        :show-usage="false"
        :workspace-id="props.workspaceId"
        :chat-scope="props.chatScope"
        @send="(req) => emit('send', req)"
        @stop="() => emit('stop')"
      />
    </template>
  </WelcomeView>
</template>
