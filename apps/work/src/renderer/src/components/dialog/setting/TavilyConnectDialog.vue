<script setup lang="ts">
import { Button } from "@willow/shadcn/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@willow/shadcn/components/ui/dialog";
import { Input } from "@willow/shadcn/components/ui/input";
import { Label } from "@willow/shadcn/components/ui/label";
import {
  CircleAlert,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Search,
  ShieldCheck,
} from "lucide-vue-next";
import { computed, ref } from "vue";
import { electronAPI } from "@/lib/ipc";

const props = defineProps<{
  mode: "connect" | "edit";
}>();

const emit = defineEmits<{
  back: [];
  saved: [];
}>();

const apiKey = ref("");
const saving = ref(false);
const showApiKey = ref(false);
const errorMessage = ref("");

const normalizedApiKey = computed(() => apiKey.value.trim());
const editing = computed(() => props.mode === "edit");

async function saveApiKey(): Promise<void> {
  if (!normalizedApiKey.value || saving.value) return;
  saving.value = true;
  errorMessage.value = "";
  try {
    await electronAPI.setTavilyApiKey({ apiKey: normalizedApiKey.value });
    apiKey.value = "";
    emit("saved");
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "保存 Tavily API Key 失败，请重试。";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <form class="grid gap-5" @submit.prevent="saveApiKey">
    <DialogHeader>
      <div class="flex items-center gap-3">
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground"
          aria-hidden="true"
        >
          <Search class="size-5" />
        </span>
        <DialogTitle>{{ editing ? "修改 Tavily" : "连接 Tavily" }}</DialogTitle>
      </div>
      <DialogDescription class="text-left">
        {{
          editing
            ? "输入新的 Tavily API Key 以替换当前配置。原密钥不会被读取或显示。"
            : "输入你的 Tavily API Key，让 Willow 使用实时网络搜索。"
        }}
      </DialogDescription>
    </DialogHeader>

    <div class="grid gap-3">
      <div class="flex items-center justify-between gap-4">
        <Label for="tavily-connect-api-key">API Key</Label>
        <a
          href="https://app.tavily.com/home"
          target="_blank"
          rel="noreferrer noopener"
          class="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          获取 API Key
          <ExternalLink class="size-3" aria-hidden="true" />
        </a>
      </div>

      <div class="relative">
        <KeyRound
          class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id="tavily-connect-api-key"
          v-model="apiKey"
          :type="showApiKey ? 'text' : 'password'"
          autocomplete="off"
          autofocus
          class="h-10 rounded-xl pr-10 pl-10"
          :placeholder="editing ? '输入新的 API Key' : 'tvly-…'"
          :disabled="saving"
        />
        <button
          type="button"
          class="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          :disabled="saving"
          :aria-label="showApiKey ? '隐藏 API Key' : '显示 API Key'"
          @click="showApiKey = !showApiKey"
        >
          <EyeOff v-if="showApiKey" class="size-4" aria-hidden="true" />
          <Eye v-else class="size-4" aria-hidden="true" />
        </button>
      </div>

      <p class="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck class="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        密钥使用本地 AES 加密，仅保存在本机
      </p>

      <div v-if="errorMessage" class="flex items-start gap-2 text-sm text-destructive" role="alert">
        <CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{{ errorMessage }}</span>
      </div>
    </div>

    <DialogFooter>
      <Button type="button" variant="outline" :disabled="saving" @click="emit('back')">取消</Button>
      <Button
        type="submit"
        :disabled="normalizedApiKey === '' || saving"
        :aria-busy="saving || undefined"
      >
        <LoaderCircle v-if="saving" class="animate-spin" aria-hidden="true" />
        {{ editing ? "更新密钥" : "提交" }}
      </Button>
    </DialogFooter>
  </form>
</template>
