<script setup lang="ts">
import type { ModelConfig, TavilyKeyConfig } from "@shared/api";
import { Badge, Button } from "@willow/shadcn";
import { Progress } from "@willow/shadcn/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@willow/shadcn/components/ui/tooltip";
import { Pencil, Plus, Star, Trash2 } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { onBeforeMount } from "vue";
import { useDialog } from "@/layout/dialog";
import { DeleteModel } from "@/layout/dialog/delete-model";
import { DeleteTavilyKey } from "@/layout/dialog/delete-tavily-key";
import { ModelForm } from "@/layout/dialog/model-form";
import { TavilyKeyForm } from "@/layout/dialog/tavily-key-form";
import { useConfigStore } from "@/stores/config";

const { openDialog } = useDialog();
const configStore = useConfigStore();
const { modelList, tavilyKeyList } = storeToRefs(configStore);

onBeforeMount(() => {
  configStore.fetchModelList();
  configStore.fetchTavilyKeyList();
});

function handleAddModel() {
  openDialog(ModelForm);
}

function handleEditModel(model: ModelConfig) {
  openDialog(ModelForm, { model });
}

function handleDeleteModel(model: ModelConfig) {
  openDialog(DeleteModel, { model });
}

async function handleSetDefault(model: ModelConfig) {
  await configStore.setDefaultModel(model.id);
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

function handleAddTavilyKey() {
  openDialog(TavilyKeyForm);
}

function handleEditTavilyKey(tavilyKey: TavilyKeyConfig) {
  openDialog(TavilyKeyForm, { tavilyKey });
}

function handleDeleteTavilyKey(tavilyKey: TavilyKeyConfig) {
  openDialog(DeleteTavilyKey, { tavilyKey });
}
</script>

<template>
  <div class="space-y-8">
    <h1 class="text-2xl font-semibold">配置</h1>

    <section class="space-y-3">
      <div class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-base font-medium">模型配置</h2>
          <p class="text-sm text-muted-foreground">管理可用的 AI 模型</p>
        </div>
        <Button size="sm" class="gap-1.5" @click="handleAddModel">
          <Plus class="size-4" />
          添加模型
        </Button>
      </div>

      <div v-if="modelList.length === 0" class="rounded-lg border p-8 text-center">
        <p class="text-sm text-muted-foreground">暂无配置的模型</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="model in modelList"
          :key="model.id"
          class="group flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
        >
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-medium">{{ model.name }}</span>
              <Badge v-if="model.isDefault" variant="default" class="text-[10px]"> 默认 </Badge>
              <Badge variant="outline" class="text-[10px]">
                {{ model.provider }}
              </Badge>
            </div>
            <p class="truncate text-xs text-muted-foreground">
              {{ model.modelId }} · {{ model.baseUrl }}
            </p>
          </div>

          <div
            class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Tooltip v-if="!model.isDefault">
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon" class="size-8" @click="handleSetDefault(model)">
                  <Star class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>设为默认</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon" class="size-8" @click="handleEditModel(model)">
                  <Pencil class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>编辑</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8 text-destructive hover:text-destructive"
                  @click="handleDeleteModel(model)"
                >
                  <Trash2 class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>删除</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <div class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-base font-medium">网络搜索 (Tavily)</h2>
          <p class="text-sm text-muted-foreground">管理 Tavily API Key，用于网络搜索功能</p>
        </div>
        <Button size="sm" class="gap-1.5" @click="handleAddTavilyKey">
          <Plus class="size-4" />
          添加 Key
        </Button>
      </div>

      <div v-if="tavilyKeyList.length === 0" class="rounded-lg border p-8 text-center">
        <p class="text-sm text-muted-foreground">暂无配置的 Tavily API Key</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="key in tavilyKeyList"
          :key="key.id"
          class="group flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
        >
          <div class="min-w-0 flex-1 space-y-2">
            <div class="flex items-center gap-2">
              <span class="font-mono text-sm">{{ maskKey(key.apiKey) }}</span>
              <Badge variant="outline" class="text-[10px]">
                {{ key.currentMonthUsage }} / {{ key.monthlyLimit }}
              </Badge>
            </div>
            <Progress
              :model-value="Math.min((key.currentMonthUsage / key.monthlyLimit) * 100, 100)"
              class="h-1.5"
            />
          </div>

          <div
            class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8"
                  @click="handleEditTavilyKey(key)"
                >
                  <Pencil class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>编辑</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8 text-destructive hover:text-destructive"
                  @click="handleDeleteTavilyKey(key)"
                >
                  <Trash2 class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>删除</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
