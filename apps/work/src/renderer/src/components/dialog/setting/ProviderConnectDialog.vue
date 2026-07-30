<script setup lang="ts">
import type { ProviderInfo } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@willow/shadcn/components/ui/dialog";
import { Input } from "@willow/shadcn/components/ui/input";
import { Label } from "@willow/shadcn/components/ui/label";
import { CircleAlert, LoaderCircle } from "lucide-vue-next";
import { computed, ref } from "vue";
import { notifyProviderConfigurationChanged } from "@/lib/app-state-events";
import { electronAPI } from "@/lib/ipc";
import ProviderMark from "./ProviderMark.vue";

const props = defineProps<{
  provider: ProviderInfo;
}>();

const emit = defineEmits<{
  back: [];
  connected: [];
}>();

const apiKey = ref("");
const busy = ref(false);
const errorMessage = ref("");
const normalizedApiKey = computed(() => apiKey.value.trim());

async function connectProvider() {
  if (!normalizedApiKey.value || busy.value) return;
  busy.value = true;
  errorMessage.value = "";
  try {
    await electronAPI.setCredential({
      providerId: props.provider.id,
      apiKey: normalizedApiKey.value,
    });
    apiKey.value = "";
    notifyProviderConfigurationChanged();
    emit("connected");
  } catch {
    errorMessage.value = "连接失败，请检查系统凭证加密是否可用后重试。";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form class="grid gap-4" @submit.prevent="connectProvider">
    <DialogHeader>
      <div class="flex items-center gap-3">
        <ProviderMark :provider-id="provider.id" :name="provider.name" />
        <DialogTitle>连接 {{ provider.name }}</DialogTitle>
      </div>
      <DialogDescription class="text-left">
        输入你的 {{ provider.apiKeyLabel }} 以连接账户，并在 Willow 中使用 {{ provider.name }}
        模型。
      </DialogDescription>
    </DialogHeader>

    <div class="grid gap-4">
      <div class="grid gap-3">
        <Input
          id="provider-connect-api-key"
          v-model="apiKey"
          type="password"
          :placeholder="provider.apiKeyLabel"
          autocomplete="off"
          autofocus
        />
      </div>
      <div
        v-if="errorMessage"
        class="flex items-center gap-2 text-sm text-destructive"
        role="alert"
      >
        <CircleAlert class="size-4" />
        {{ errorMessage }}
      </div>
    </div>

    <DialogFooter>
      <Button type="button" variant="outline" @click="emit('back')">取消</Button>
      <Button type="submit" :disabled="!normalizedApiKey || busy" :aria-busy="busy || undefined">
        <LoaderCircle v-if="busy" class="animate-spin" aria-hidden="true" />
        提交
      </Button>
    </DialogFooter>
  </form>
</template>
