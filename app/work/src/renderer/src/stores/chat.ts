import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { getClient, getClientForDirectory } from "@/api/client";
import type {
  Session,
  Message,
  Part,
  Event,
} from "@opencode-ai/sdk/v2/client";

/**
 * session.messages 返回的实际结构：
 * Array<{ info: Message; parts: Part[] }>
 */
type MessageWithParts = {
  info: Message;
  parts: Part[];
};

export const useChatStore = defineStore("chat", () => {
  // ─── 状态 ───────────────────────────────────────────────
  const sessions = ref<Session[]>([]);
  const currentSessionId = ref<string | null>(null);
  const messages = ref<Message[]>([]);

  /**
   * 消息 parts 映射表
   * 使用 Record 而非 Map，以便 Vue 的深度响应式能正确追踪变更
   */
  const partsMap = ref<Record<string, Part[]>>({});

  const isLoading = ref(false);
  const isSending = ref(false);

  /**
   * 草稿模式：点击「新建对话」时进入，此时还未真正调用 API 创建 session。
   * 等用户发送第一条消息时才创建 session 并发送。
   */
  const isDraftSession = ref(true);

  /**
   * 草稿模式下用户选择的操作目录。
   * null 表示使用默认工作空间目录。
   */
  const draftDirectory = ref<string | null>(null);

  /**
   * 助手是否正在生成回复（通过 SSE session.status 追踪）
   * idle = 空闲, busy = 生成中, retry = 重试中
   */
  const sessionStatus = ref<"idle" | "busy" | "retry">("idle");
  const isGenerating = computed(() => sessionStatus.value === "busy");

  /** 会话错误信息（通过 SSE session.error 追踪） */
  const sessionError = ref<string | null>(null);

  // ─── Getters ────────────────────────────────────────────
  const currentSession = computed(() =>
    sessions.value.find((s) => s.id === currentSessionId.value) ?? null,
  );

  const sortedMessages = computed(() =>
    [...messages.value].sort((a, b) => a.time.created - b.time.created),
  );

  // ─── Actions ────────────────────────────────────────────

  /** 加载会话列表 */
  async function loadSessions() {
    try {
      const client = getClient();
      const { data } = await client.session.list();
      sessions.value = data || [];
    } catch (err) {
      console.error("[chat] Failed to load sessions:", err);
    }
  }

  /**
   * 进入「新建对话」草稿模式。
   * 清空当前会话状态，但不调用 API。
   * 等用户发送第一条消息时再真正创建 session。
   */
  function startDraftSession() {
    currentSessionId.value = null;
    messages.value = [];
    partsMap.value = {};
    sessionStatus.value = "idle";
    sessionError.value = null;
    isDraftSession.value = true;
    draftDirectory.value = null;
  }

  /** 设置草稿模式下的操作目录 */
  function setDraftDirectory(directory: string | null) {
    draftDirectory.value = directory;
  }

  /**
   * 创建新会话（内部方法，由 sendMessage 在 draft 模式下调用）
   * @param directory 可选的操作目录；不传时使用默认客户端
   */
  async function createSession(directory?: string | null) {
    try {
      const client = directory
        ? getClientForDirectory(directory)
        : getClient();
      const { data } = await client.session.create();
      if (data) {
        // 防止与 SSE session.created 事件竞态导致重复
        if (!sessions.value.find((s) => s.id === data.id)) {
          sessions.value.unshift(data);
        }
        currentSessionId.value = data.id;
      }
      return data;
    } catch (err) {
      console.error("[chat] Failed to create session:", err);
      return null;
    }
  }

  /** 选择已有会话 */
  async function selectSession(sessionId: string) {
    if (currentSessionId.value === sessionId && !isDraftSession.value) return;
    isDraftSession.value = false;
    currentSessionId.value = sessionId;
    messages.value = [];
    partsMap.value = {};
    sessionStatus.value = "idle";
    sessionError.value = null;
    await loadMessages();
  }

  /** 加载当前会话的消息（含 parts） */
  async function loadMessages() {
    if (!currentSessionId.value) return;

    isLoading.value = true;
    try {
      const client = getClient();
      const { data } = await client.session.messages({
        sessionID: currentSessionId.value,
      });

      // API 返回 Array<{ info: Message; parts: Part[] }>
      const items = (data || []) as unknown as MessageWithParts[];
      const loadedMessages: Message[] = [];
      const loadedParts: Record<string, Part[]> = {};

      for (const item of items) {
        loadedMessages.push(item.info);
        if (item.parts && item.parts.length > 0) {
          loadedParts[item.info.id] = item.parts;
        }
      }

      messages.value = loadedMessages;
      partsMap.value = loadedParts;
    } catch (err) {
      console.error("[chat] Failed to load messages:", err);
    } finally {
      isLoading.value = false;
    }
  }

  /** 发送消息（异步模式，通过 SSE 获取流式响应） */
  async function sendMessage(text: string) {
    if (!text.trim() || isSending.value) return;

    isSending.value = true;
    // 在 draft 模式下记录选择的目录（发送后会清除 draft 状态）
    const directory = isDraftSession.value ? draftDirectory.value : null;

    try {
      // draft 模式：先创建 session
      if (isDraftSession.value || !currentSessionId.value) {
        const session = await createSession(directory);
        if (!session) {
          console.error("[chat] Failed to create session in draft mode");
          return;
        }
        isDraftSession.value = false;
      }

      const client = directory
        ? getClientForDirectory(directory)
        : getClient();
      await client.session.promptAsync({
        sessionID: currentSessionId.value!,
        parts: [{ type: "text", text: text.trim() }],
      });
    } catch (err) {
      console.error("[chat] Failed to send message:", err);
    } finally {
      isSending.value = false;
    }
  }

  /** 中止当前会话 */
  async function abortSession() {
    if (!currentSessionId.value) return;
    try {
      const client = getClient();
      await client.session.abort({ sessionID: currentSessionId.value });
    } catch (err) {
      console.error("[chat] Failed to abort:", err);
    }
  }

  /** 删除会话 */
  async function deleteSession(sessionId: string) {
    try {
      const client = getClient();
      await client.session.delete({ sessionID: sessionId });
      sessions.value = sessions.value.filter((s) => s.id !== sessionId);
      if (currentSessionId.value === sessionId) {
        currentSessionId.value = null;
        messages.value = [];
        partsMap.value = {};
        sessionStatus.value = "idle";
        sessionError.value = null;
        isDraftSession.value = true;
      }
    } catch (err) {
      console.error("[chat] Failed to delete session:", err);
    }
  }

  /** 重命名会话 */
  async function renameSession(sessionId: string, title: string) {
    try {
      const client = getClient();
      await client.session.update({ sessionID: sessionId, title });
      const idx = sessions.value.findIndex((s) => s.id === sessionId);
      if (idx >= 0) {
        sessions.value[idx] = { ...sessions.value[idx], title };
      }
    } catch (err) {
      console.error("[chat] Failed to rename session:", err);
    }
  }

  // ─── SSE 事件处理 ─────────────────────────────────────

  /**
   * 处理 SSE 事件，更新本地状态
   *
   * 严格按照 SDK 类型定义解构 event.properties：
   * - message.updated     → { info: Message }
   * - message.removed     → { sessionID, messageID }
   * - message.part.updated → { part: Part, delta?: string }
   * - message.part.removed → { sessionID, messageID, partID }
   * - session.status      → { sessionID, status }
   * - session.idle        → { sessionID }
   * - session.error       → { sessionID?, error? }
   * - session.created     → { info: Session }
   * - session.updated     → { info: Session }
   * - session.deleted     → { info: Session }
   */
  function handleEvent(event: Event) {
    switch (event.type) {
      // ── 消息更新 ──
      // SDK: EventMessageUpdated { properties: { info: Message } }
      case "message.updated": {
        const { info: msg } = event.properties as { info: Message };
        if (msg.sessionID !== currentSessionId.value) return;
        const idx = messages.value.findIndex((m) => m.id === msg.id);
        if (idx >= 0) {
          messages.value.splice(idx, 1, msg);
        } else {
          messages.value.push(msg);
        }
        break;
      }

      // ── 消息删除 ──
      // SDK: EventMessageRemoved { properties: { sessionID, messageID } }
      case "message.removed": {
        const { sessionID, messageID } = event.properties as {
          sessionID: string;
          messageID: string;
        };
        if (sessionID !== currentSessionId.value) return;
        messages.value = messages.value.filter((m) => m.id !== messageID);
        delete partsMap.value[messageID];
        break;
      }

      // ── Part 更新（流式输出核心） ──
      // SDK: EventMessagePartUpdated { properties: { part: Part, delta?: string } }
      // 注意：sessionID 和 messageID 在 part 对象内部，不在 properties 顶层
      case "message.part.updated": {
        const { part } = event.properties as { part: Part; delta?: string };
        const partSessionID = (part as any).sessionID as string;
        const partMessageID = (part as any).messageID as string;

        if (partSessionID !== currentSessionId.value) return;

        const existing = partsMap.value[partMessageID] || [];
        const partIdx = existing.findIndex((p) => p.id === part.id);

        if (partIdx >= 0) {
          existing[partIdx] = part;
        } else {
          existing.push(part);
        }

        // 赋值新数组以触发 Vue 响应式
        partsMap.value[partMessageID] = [...existing];
        break;
      }

      // ── Part 删除 ──
      // SDK: EventMessagePartRemoved { properties: { sessionID, messageID, partID } }
      case "message.part.removed": {
        const { sessionID, messageID, partID } = event.properties as {
          sessionID: string;
          messageID: string;
          partID: string;
        };
        if (sessionID !== currentSessionId.value) return;
        const existing = partsMap.value[messageID];
        if (existing) {
          partsMap.value[messageID] = existing.filter(
            (p) => p.id !== partID,
          );
        }
        break;
      }

      // ── 会话状态（busy / idle / retry）──
      // SDK: EventSessionStatus { properties: { sessionID, status: SessionStatus } }
      case "session.status": {
        const { sessionID, status } = event.properties as {
          sessionID: string;
          status: { type: "idle" | "busy" | "retry" };
        };
        if (sessionID === currentSessionId.value) {
          sessionStatus.value = status.type;
          if (status.type === "busy") {
            sessionError.value = null;
          }
        }
        break;
      }

      // SDK: EventSessionIdle { properties: { sessionID } }
      case "session.idle": {
        const { sessionID } = event.properties as { sessionID: string };
        if (sessionID === currentSessionId.value) {
          sessionStatus.value = "idle";
        }
        break;
      }

      // ── 会话错误 ──
      // SDK: EventSessionError { properties: { sessionID?, error? } }
      case "session.error": {
        const { sessionID, error: errData } = event.properties as {
          sessionID?: string;
          error?: { name: string; data?: { message?: string } };
        };
        if (sessionID === currentSessionId.value) {
          sessionError.value =
            errData?.data?.message || errData?.name || "未知错误";
          sessionStatus.value = "idle";
          console.error("[chat] Session error:", errData);
        }
        break;
      }

      // ── 会话 CRUD ──
      // SDK: EventSessionUpdated { properties: { info: Session } }
      case "session.updated": {
        const { info: sess } = event.properties as { info: Session };
        const idx = sessions.value.findIndex((s) => s.id === sess.id);
        if (idx >= 0) {
          sessions.value.splice(idx, 1, sess);
        }
        break;
      }

      // SDK: EventSessionCreated { properties: { info: Session } }
      case "session.created": {
        const { info: sess } = event.properties as { info: Session };
        if (!sessions.value.find((s) => s.id === sess.id)) {
          sessions.value.unshift(sess);
        }
        break;
      }

      // SDK: EventSessionDeleted { properties: { info: Session } }
      case "session.deleted": {
        const { info: sess } = event.properties as { info: Session };
        const deletedId = sess.id;
        sessions.value = sessions.value.filter((s) => s.id !== deletedId);
        if (currentSessionId.value === deletedId) {
          currentSessionId.value = null;
          messages.value = [];
          partsMap.value = {};
          sessionStatus.value = "idle";
          sessionError.value = null;
        }
        break;
      }
    }
  }

  /** 获取消息的 parts */
  function getMessageParts(messageId: string): Part[] {
    return partsMap.value[messageId] || [];
  }

  return {
    // state
    sessions,
    currentSessionId,
    messages,
    partsMap,
    isLoading,
    isSending,
    isDraftSession,
    draftDirectory,
    sessionStatus,
    sessionError,
    // getters
    currentSession,
    sortedMessages,
    isGenerating,
    // actions
    loadSessions,
    startDraftSession,
    setDraftDirectory,
    createSession,
    selectSession,
    loadMessages,
    sendMessage,
    abortSession,
    deleteSession,
    renameSession,
    handleEvent,
    getMessageParts,
  };
});
