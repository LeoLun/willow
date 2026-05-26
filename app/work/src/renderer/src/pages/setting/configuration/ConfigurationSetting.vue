<script setup lang="ts">
import type { ModelConfig, TavilyKeyConfig } from "@shared/api";
import type { McpServerConfig } from "@shared/api";
import { isBuiltinModel } from "@shared/model-config";
import { Badge, Button } from "@willow/shadcn";
import { Input } from "@willow/shadcn/components/ui/input";
import { Progress } from "@willow/shadcn/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@willow/shadcn/components/ui/tooltip";
import { Pencil, Plus, Star, Trash2, Key, Check } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { computed, onBeforeMount, ref } from "vue";
import { useDialog } from "@/layout/dialog";
import { DeleteMcpServer } from "@/layout/dialog/delete-mcp-server";
import { DeleteTavilyKey } from "@/layout/dialog/delete-tavily-key";
import { McpServerForm } from "@/layout/dialog/mcp-server-form";
import { ModelKeyForm } from "@/layout/dialog/model-key-form";
import { TavilyKeyForm } from "@/layout/dialog/tavily-key-form";
import { useConfigStore } from "@/stores/config";
import { useMcpStore } from "@/stores/mcp";

const { openDialog } = useDialog();
const configStore = useConfigStore();
const mcpStore = useMcpStore();
const { modelList, tavilyKeyList } = storeToRefs(configStore);
const { globalServers } = storeToRefs(mcpStore);

const isSaving = ref(false);

const builtinModels = computed(() => modelList.value.filter((m) => isBuiltinModel(m.modelId)));
const nonBuiltinModels = computed(() => modelList.value.filter((m) => !isBuiltinModel(m.modelId)));

const deepSeekApiKey = computed(() => {
  const pro = builtinModels.value.find((m) => m.modelId === "deepseek-v4-pro");
  return pro?.apiKey || null;
});

const hasDeepSeekKey = computed(() => !!deepSeekApiKey.value);

onBeforeMount(() => {
  configStore.fetchModelList();
  configStore.fetchTavilyKeyList();
  mcpStore.fetchGlobalServers();
});

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

function handleAddModel() {
  openDialog(ModelKeyForm);
}

function handleEditModel() {
  openDialog(ModelKeyForm, {
    isEdit: true,
    initialApiKey: deepSeekApiKey.value || "",
  });
}

async function handleClearKey() {
  isSaving.value = true;
  try {
    await configStore.setDeepSeekApiKey("");
  } catch (e) {
    console.error(e);
  } finally {
    isSaving.value = false;
  }
}

async function handleSetDefault(model: ModelConfig) {
  await configStore.setDefaultModel(model.id);
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

function handleAddMcp() {
  openDialog(McpServerForm);
}

function handleEditMcp(server: McpServerConfig) {
  openDialog(McpServerForm, { mcpServer: server });
}

function handleDeleteMcp(server: McpServerConfig) {
  openDialog(DeleteMcpServer, { mcpServer: server });
}

async function handleToggleMcp(server: McpServerConfig) {
  await mcpStore.toggleServer(undefined, server.name, !server.disabled);
}
</script>

<template>
  <div class="space-y-8">
    <h1 class="text-2xl font-semibold">配置</h1>

    <section class="space-y-3">
      <div class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-base font-medium">DeepSeek API Key</h2>
          <p class="text-sm text-muted-foreground">
            输入 API Key 后自动配置 DeepSeek V4 Pro 和 Flash 模型
          </p>
        </div>
      </div>

      <!-- 未配置 -->
      <div
        v-if="!hasDeepSeekKey"
        class="flex flex-col items-center justify-center gap-3 rounded-lg border p-6"
      >
        <p class="text-sm text-muted-foreground">未配置 DeepSeek 模型密钥</p>
        <Button size="sm" @click="handleAddModel">
          <Plus class="mr-1.5 size-4" />
          添加模型
        </Button>
      </div>

      <!-- 已配置 API Key -->
      <div v-else class="space-y-3 rounded-lg border p-4">
        <div class="flex items-center gap-2">
          <Check class="size-4 text-green-500" />
          <span class="text-sm font-medium">已配置 API Key</span>
          <Badge variant="outline" class="text-[10px]">{{ maskKey(deepSeekApiKey!) }}</Badge>
        </div>
        <p class="text-xs text-muted-foreground">可用模型：DeepSeek V4 Pro、DeepSeek V4 Flash</p>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" @click="handleEditModel">
            <Pencil class="mr-1 size-3.5" />
            修改
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-destructive hover:text-destructive"
            :disabled="isSaving"
            @click="handleClearKey"
          >
            <Trash2 class="mr-1 size-3.5" />
            清除
          </Button>
        </div>
      </div>

      <!-- 模型列表 -->
      <div v-if="builtinModels.length > 0" class="space-y-2">
        <div
          v-for="model in builtinModels"
          :key="model.id"
          class="group flex items-center justify-between gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50"
        >
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-medium">{{ model.name }}</span>
              <Badge v-if="model.isDefault" variant="default" class="text-[10px]"> 默认 </Badge>
            </div>
            <p class="truncate text-xs text-muted-foreground">
              {{ model.modelId }} · {{ model.baseUrl }}
            </p>
          </div>

          <Tooltip v-if="!model.isDefault">
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="size-8" @click="handleSetDefault(model)">
                <Star class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>设为默认</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <!-- 非内置模型（向后兼容） -->
      <div v-if="nonBuiltinModels.length > 0" class="space-y-2">
        <p class="text-xs text-muted-foreground">旧版模型</p>
        <div
          v-for="model in nonBuiltinModels"
          :key="model.id"
          class="flex items-center gap-3 rounded-lg border p-3"
        >
          <span class="truncate text-sm">{{ model.name }}</span>
          <Badge variant="outline" class="ml-2 text-[10px]">{{ model.provider }}</Badge>
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

    <section class="space-y-3">
      <div class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-base font-medium">MCP 服务 (全局)</h2>
          <p class="text-sm text-muted-foreground">
            管理全局 Model Context Protocol 服务，动态加载工具
          </p>
        </div>
        <Button size="sm" class="gap-1.5" @click="handleAddMcp">
          <Plus class="size-4" />
          添加服务
        </Button>
      </div>

      <div v-if="globalServers.length === 0" class="rounded-lg border p-8 text-center">
        <p class="text-sm text-muted-foreground">暂无配置的全局 MCP 服务</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="server in globalServers"
          :key="server.name"
          class="group flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
        >
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-2">
              <span class="font-mono text-sm">{{ server.name }}</span>
              <Badge variant="outline" class="text-[10px]">{{ server.type }}</Badge>
              <Badge v-if="server.disabled" variant="secondary" class="text-[10px]">已禁用</Badge>
            </div>
            <p v-if="server.type === 'stdio'" class="truncate text-xs text-muted-foreground">
              {{ server.command }} {{ (server.args || []).join(" ") }}
            </p>
            <p v-else class="truncate text-xs text-muted-foreground">
              {{ server.url }}
            </p>
          </div>

          <div class="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" class="h-7 text-xs" @click="handleToggleMcp(server)">
              {{ server.disabled ? "启用" : "禁用" }}
            </Button>
            <div
              class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button variant="ghost" size="icon" class="size-8" @click="handleEditMcp(server)">
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
                    @click="handleDeleteMcp(server)"
                  >
                    <Trash2 class="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>删除</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
