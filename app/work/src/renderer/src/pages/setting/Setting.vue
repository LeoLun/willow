<script setup lang="ts">
import type { ModelConfig } from "@shared/api";
import { Monitor, Moon, Pencil, Plus, Star, Sun, Trash2 } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { onBeforeMount } from "vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDarkMode } from "@/composables/useDarkMode";
import type { ThemeMode } from "@/composables/useDarkMode";
import { useDialog } from "@/layout/dialog";
import { DeleteModel } from "@/layout/dialog/delete-model";
import { ModelForm } from "@/layout/dialog/model-form";
import { useConfigStore } from "@/stores/config";

const { themeMode } = useDarkMode();
const { openDialog } = useDialog();
const configStore = useConfigStore();
const { modelList } = storeToRefs(configStore);

const themeModes: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "跟随系统", icon: Monitor },
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
];

function onThemeChange(value: string | string[]) {
  if (value) {
    themeMode.value = value as ThemeMode;
  }
}

// ─── 模型管理 ───
onBeforeMount(() => {
  configStore.fetchModelList();
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
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-8 p-8">
    <h1 class="text-2xl font-semibold">设置</h1>

    <!-- 外观 -->
    <section class="space-y-4">
      <div>
        <h2 class="text-base font-medium">外观</h2>
        <p class="text-sm text-muted-foreground">自定义应用的显示主题</p>
      </div>

      <div class="flex items-center justify-between rounded-lg border p-4">
        <div class="space-y-0.5">
          <span class="text-sm font-medium">主题模式</span>
          <p class="text-xs text-muted-foreground">选择浅色、深色或跟随系统</p>
        </div>

        <ToggleGroup
          type="single"
          :model-value="themeMode"
          variant="outline"
          @update:model-value="onThemeChange"
        >
          <ToggleGroupItem
            v-for="mode in themeModes"
            :key="mode.value"
            :value="mode.value"
            :aria-label="mode.label"
            class="gap-1.5 px-3"
          >
            <component :is="mode.icon" class="size-4" />
            <span class="text-xs">{{ mode.label }}</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </section>

    <!-- 模型配置 -->
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-medium">模型配置</h2>
          <p class="text-sm text-muted-foreground">管理可用的 AI 模型</p>
        </div>
        <Button size="sm" class="gap-1" @click="handleAddModel">
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
          class="group flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
        >
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium">{{ model.name }}</span>
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
  </div>
</template>
