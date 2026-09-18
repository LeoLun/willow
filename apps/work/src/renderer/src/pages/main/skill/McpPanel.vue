<script setup lang="ts">
import type { GetMcpResponse, McpProjectEvent, McpTarget } from "@shared/api";
import { MCP_STATUS_EVENT } from "@shared/constants";
import { Skeleton } from "@willow/shadcn/components/ui/skeleton";
import { Blocks } from "lucide-vue-next";
import { onMounted, onUnmounted, ref } from "vue";
import { useDialog } from "@/components/dialog";
import McpLoginDialog from "@/components/dialog/mcp/McpLoginDialog.vue";
import { Button } from "@/components/ui/button";
import { useEventBus } from "@/composables/useEventBus";
import { electronAPI } from "@/lib/ipc";

const props = defineProps<{ target: McpTarget; title: string; heading?: boolean }>();
const project = ref<GetMcpResponse>();
const error = ref("");
const loading = ref(false);
const checking = ref(new Set<string>());
const loggingOut = ref(new Set<string>());
const logoutErrors = ref<Record<string, string>>({});
const checkErrors = ref<Record<string, string>>({});
let alive = true;
let requestRevision = 0;
let receivedRevision = -1;
const { openDialog } = useDialog();
function openLogin(server: GetMcpResponse["servers"][number]) {
  openDialog(McpLoginDialog, {
    ...(server.source === "global" ? { scope: "global" } : props.target),
    serverName: server.name,
  });
}
const statusLabels = {
  "not-connected": "未连接",
  connecting: "连接中",
  connected: "已连接",
  authenticating: "登录中",
  "needs-auth": "需要登录",
  failed: "失败",
  disabled: "已禁用",
};
const { addEventListener, removeEventListener, waitUntilReady } = useEventBus();
function accept(next: GetMcpResponse) {
  if (!alive) return;
  if (next.status.revision < receivedRevision) return;
  receivedRevision = next.status.revision;
  project.value = next;
  for (const server of next.servers) {
    if (server.status === "connected") delete checkErrors.value[server.name];
  }
}
async function reload() {
  if (!alive) return;
  const revision = ++requestRevision;
  loading.value = true;
  error.value = "";
  try {
    const next = await electronAPI.getMcp({ ...props.target });
    if (revision === requestRevision) accept(next);
  } catch (e) {
    if (alive && revision === requestRevision)
      error.value = e instanceof Error ? e.message : "加载 MCP 服务失败。";
  } finally {
    if (alive && revision === requestRevision) loading.value = false;
  }
}
function onStatus(event: McpProjectEvent) {
  const matches =
    props.target.scope === "global"
      ? event.scope === "global"
      : event.scope === "global" || event.workspaceId === props.target.workspaceId;
  if (matches) void reload();
}
async function checkConnection(serverName: string) {
  if (checking.value.has(serverName) || loggingOut.value.has(serverName)) return;
  checking.value.add(serverName);
  delete checkErrors.value[serverName];
  try {
    const response = await electronAPI.manageMcp({
      ...props.target,
      serverName,
      action: "connect",
    });
    if (alive) accept(response.project);
  } catch (cause) {
    if (!alive) return;
    checkErrors.value[serverName] = cause instanceof Error ? cause.message : "连接失败，请重试。";
    await reload();
  } finally {
    if (alive) checking.value.delete(serverName);
  }
}
async function logout(server: GetMcpResponse["servers"][number]) {
  if (loggingOut.value.has(server.name) || checking.value.has(server.name)) return;
  loggingOut.value.add(server.name);
  delete logoutErrors.value[server.name];
  try {
    const response = await electronAPI.manageMcp({
      ...props.target,
      serverName: server.name,
      action: "logout",
    });
    if (alive) {
      delete checkErrors.value[server.name];
      accept(response.project);
    }
  } catch (cause) {
    if (alive)
      logoutErrors.value[server.name] =
        cause instanceof Error ? cause.message : "退出登录失败，请重试。";
  } finally {
    if (alive) loggingOut.value.delete(server.name);
  }
}
onMounted(async () => {
  addEventListener(MCP_STATUS_EVENT, onStatus);
  await waitUntilReady().catch(() => undefined);
  await reload();
});
onUnmounted(() => {
  alive = false;
  removeEventListener(MCP_STATUS_EVENT, onStatus);
});
</script>

<template>
  <div :aria-label="title" data-slot="mcp-panel">
    <template v-if="heading">
      <div class="flex items-end justify-between gap-4">
        <h2 class="text-lg font-semibold text-foreground">{{ title }}</h2>
        <span class="text-sm text-muted-foreground">{{ project?.servers.length ?? 0 }} 项</span>
      </div>
      <div class="mt-2 border-b pb-3">
        <span
          class="inline-flex items-center rounded-xl bg-muted px-3 py-1.5 text-sm font-medium text-foreground"
          >全局 MCP
          <span class="ml-2 text-xs text-muted-foreground">{{
            project?.servers.length ?? 0
          }}</span></span
        >
      </div>
    </template>
    <div :class="heading ? 'mt-8' : ''">
      <div v-if="loading && !project" class="grid gap-x-14 gap-y-8 md:grid-cols-2">
        <div v-for="index in 4" :key="index" class="flex items-start gap-4">
          <Skeleton class="size-12 shrink-0 rounded-2xl" />
          <div class="flex-1 space-y-2">
            <Skeleton class="h-4 w-32" /><Skeleton class="h-3 w-4/5" />
          </div>
        </div>
      </div>
      <div
        v-else-if="error || project?.configError"
        class="flex min-h-36 flex-col items-center justify-center text-center"
        role="alert"
      >
        <Blocks class="size-8 text-muted-foreground" aria-hidden="true" />
        <p class="mt-3 text-sm text-muted-foreground">{{ error || project?.configError }}</p>
        <Button variant="secondary" class="mt-5" @click="reload">重试</Button>
      </div>
      <div
        v-else-if="project?.servers.length"
        class="grid gap-x-14 gap-y-8 md:grid-cols-2"
        data-slot="mcp-server-list"
      >
        <article
          v-for="server in project.servers"
          :key="server.name"
          class="flex min-w-0 items-start gap-4"
          data-slot="mcp-server-item"
        >
          <div
            class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground"
          >
            <Blocks class="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-3">
              <h3 class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {{ server.name }}
              </h3>
              <span class="shrink-0 text-xs text-muted-foreground">{{
                checking.has(server.name) ? "连接中" : statusLabels[server.status]
              }}</span>
              <Button
                v-if="server.status === 'needs-auth' && !checking.has(server.name)"
                variant="secondary"
                class="h-6 shrink-0 px-2 text-xs"
                :aria-label="`登录 MCP：${server.name}`"
                data-slot="mcp-login"
                @click="openLogin(server)"
                >去登录</Button
              >
              <Button
                variant="secondary"
                class="h-6 shrink-0 px-2 text-xs"
                :disabled="
                  checking.has(server.name) ||
                  loggingOut.has(server.name) ||
                  ['disabled', 'connecting', 'authenticating'].includes(server.status)
                "
                :aria-label="`检查 MCP 连接：${server.name}`"
                :aria-busy="checking.has(server.name)"
                data-slot="mcp-check"
                @click="checkConnection(server.name)"
                >{{ checking.has(server.name) ? "检查中…" : "Check" }}</Button
              >
            </div>
            <p
              class="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground"
              :title="server.definition.url || server.definition.command"
            >
              {{ server.transport === "stdio" ? server.definition.command : server.definition.url }}
              · {{ server.toolCount }} 个工具{{ server.cached ? "（缓存）" : "" }}
            </p>
            <div
              v-if="
                (server.hasCredentials && server.status !== 'needs-auth') ||
                (server.source === 'global' && target.scope !== 'global')
              "
              class="mt-1 flex flex-wrap items-center gap-2"
            >
              <span
                v-if="server.source === 'global' && target.scope !== 'global'"
                class="text-xs text-muted-foreground"
                >全局</span
              >
              <span
                v-if="server.hasCredentials && server.status !== 'needs-auth'"
                class="text-xs text-emerald-700 dark:text-emerald-400"
                data-slot="mcp-logged-in"
                >已登录</span
              >
              <Button
                v-if="server.hasCredentials && server.status !== 'needs-auth'"
                variant="ghost"
                class="h-6 px-2 text-xs"
                :disabled="loggingOut.has(server.name) || checking.has(server.name)"
                :aria-label="`退出登录 MCP：${server.name}`"
                data-slot="mcp-logout"
                @click="logout(server)"
                >{{ loggingOut.has(server.name) ? "退出中…" : "退出登录" }}</Button
              >
            </div>
            <p
              v-if="logoutErrors[server.name] || checkErrors[server.name] || server.error"
              class="mt-1 text-xs text-destructive"
              role="alert"
            >
              {{ logoutErrors[server.name] || checkErrors[server.name] || server.error }}
            </p>
          </div>
        </article>
      </div>
      <div
        v-else
        class="flex min-h-30 flex-col items-center justify-center text-center"
        data-slot="mcp-empty"
      >
        <Blocks class="size-8 text-muted-foreground" aria-hidden="true" />
        <p class="mt-3 text-sm text-muted-foreground">
          {{ target.scope === "global" ? "暂无全局 MCP" : "当前项目暂无 MCP" }}
        </p>
      </div>
    </div>
  </div>
</template>
