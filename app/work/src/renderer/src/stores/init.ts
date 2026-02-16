import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { electronAPI } from "@renderer/src/lib/ipc";

/** 初始化步骤 */
export type InitStep = "idle" | "workspace" | "opencode" | "done" | "error";

/** 切换到主界面前的短暂延迟（ms），让用户看到 100% 状态 */
const READY_DELAY_MS = 600;

export const useInitStore = defineStore("init", () => {
  // ─── 状态 ───────────────────────────────────────────────
  const step = ref<InitStep>("idle");
  const progressMessage = ref("");
  const progressPercent = ref(0);
  const errorMessage = ref("");

  /** 工作空间信息 */
  const workspacePath = ref("");
  const baseStartPath = ref("");

  /** OpenCode 服务信息 */
  const opencodeUrl = ref("");

  /** 初始化完成（逻辑上） */
  const isInitialized = computed(() => step.value === "done");

  /** 准备就绪，可切换到主界面（带延迟） */
  const isReady = ref(false);

  // ─── 清理函数收集器 ────────────────────────────────────
  const cleanups: Array<() => void> = [];

  // ─── 初始化动作 ─────────────────────────────────────────
  async function startInit() {
    if (step.value !== "idle" && step.value !== "error") return;

    step.value = "workspace";
    progressMessage.value = "正在准备初始化\u2026";
    progressPercent.value = 5;
    errorMessage.value = "";
    isReady.value = false;

    // 监听进度
    cleanups.push(
      electronAPI.onInitProgress((payload) => {
        const msg = payload.data || payload.message || "";
        if (msg) {
          progressMessage.value = msg;
        }
      }),
    );

    // 监听工作空间完成
    cleanups.push(
      electronAPI.onInitWorkspace((payload) => {
        workspacePath.value = payload.data.workspacePath;
        baseStartPath.value = payload.data.baseStartPath;
        step.value = "opencode";
        progressPercent.value = 40;
        progressMessage.value = "工作空间就绪，正在启动服务\u2026";
      }),
    );

    // 监听 OpenCode 服务完成
    cleanups.push(
      electronAPI.onInitOpencodeService((payload) => {
        opencodeUrl.value = payload.data.url;
        progressPercent.value = 90;
        progressMessage.value = "服务启动成功，即将进入\u2026";
      }),
    );

    try {
      await electronAPI.init();

      // init IPC 完成 = 所有步骤结束
      progressPercent.value = 100;
      progressMessage.value = "初始化完成";
      step.value = "done";

      // 延迟清理 IPC 监听 & 标记就绪
      // 不在 finally 中立即清理，因为刷新渲染进程时主进程快速路径
      // 的 event.sender.send() 事件可能晚于 invoke 响应到达。
      // 延迟到 READY_DELAY_MS 后再清理，确保所有 IPC 事件已处理。
      setTimeout(() => {
        cleanups.forEach((fn) => fn());
        cleanups.length = 0;
        isReady.value = true;
      }, READY_DELAY_MS);
    } catch (err) {
      step.value = "error";
      errorMessage.value =
        err instanceof Error ? err.message : "初始化失败，请重试";
      progressPercent.value = 0;
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
    }
  }

  return {
    // state
    step,
    progressMessage,
    progressPercent,
    errorMessage,
    workspacePath,
    baseStartPath,
    opencodeUrl,
    // getters
    isInitialized,
    isReady,
    // actions
    startInit,
  };
});
