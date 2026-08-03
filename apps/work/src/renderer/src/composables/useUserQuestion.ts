import type {
  AskUserAnswers,
  UserQuestionEventPayload,
  UserQuestionResolvedEventPayload,
} from "@shared/api";
import { USER_QUESTION_EVENT, USER_QUESTION_RESOLVED_EVENT } from "@shared/constants";
import { createGlobalState } from "@vueuse/core";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  toValue,
  type MaybeRefOrGetter,
} from "vue";
import { electronAPI } from "@/lib/ipc";
import { useEventBus } from "./useEventBus";

const useUserQuestionState = createGlobalState(() => {
  const questions = shallowRef<ReadonlyMap<string, UserQuestionEventPayload>>(new Map());
  const revisions = new Map<string, number>();

  function setQuestion(
    workspaceId: number,
    sessionId: string,
    question?: UserQuestionEventPayload,
  ): void {
    const next = new Map(questions.value);
    const key = questionKey(workspaceId, sessionId);
    if (question) next.set(key, question);
    else next.delete(key);
    questions.value = next;
    revisions.set(key, (revisions.get(key) ?? 0) + 1);
  }

  function handleRequested(payload: UserQuestionEventPayload): void {
    setQuestion(payload.workspaceId, payload.sessionId, payload);
  }

  function handleResolved(payload: UserQuestionResolvedEventPayload): void {
    const current = questions.value.get(questionKey(payload.workspaceId, payload.sessionId));
    if (current?.requestId === payload.requestId) {
      setQuestion(payload.workspaceId, payload.sessionId);
    }
  }

  function getRevision(workspaceId: number, sessionId: string): number {
    return revisions.get(questionKey(workspaceId, sessionId)) ?? 0;
  }

  function hydrate(
    workspaceId: number,
    sessionId: string,
    question: UserQuestionEventPayload | undefined,
    expectedRevision: number,
  ): boolean {
    if (getRevision(workspaceId, sessionId) !== expectedRevision) return false;
    setQuestion(workspaceId, sessionId, question);
    return true;
  }

  async function resolveQuestion(requestId: string, answers?: AskUserAnswers): Promise<void> {
    const question = [...questions.value.values()].find(
      (candidate) => candidate.requestId === requestId,
    );
    if (!question) throw new Error("问题请求已失效");
    const response = await electronAPI.resolveUserQuestion({
      requestId,
      workspaceId: question.workspaceId,
      sessionId: question.sessionId,
      answers,
    });
    if (
      !response.resolved ||
      questions.value.get(questionKey(question.workspaceId, question.sessionId))?.requestId ===
        requestId
    ) {
      setQuestion(question.workspaceId, question.sessionId);
    }
  }

  return {
    questions,
    getRevision,
    handleRequested,
    handleResolved,
    hydrate,
    resolveQuestion,
  };
});

function questionKey(workspaceId: number, sessionId: string): string {
  return `${workspaceId}:${sessionId}`;
}

export function getUserQuestionRevision(workspaceId: number, sessionId: string): number {
  return useUserQuestionState().getRevision(workspaceId, sessionId);
}

export function hydrateUserQuestion(
  workspaceId: number,
  sessionId: string,
  question?: UserQuestionEventPayload,
  expectedRevision = getUserQuestionRevision(workspaceId, sessionId),
): boolean {
  return useUserQuestionState().hydrate(workspaceId, sessionId, question, expectedRevision);
}

export function useUserQuestionListener(): void {
  const { handleRequested, handleResolved } = useUserQuestionState();
  const { addEventListener, removeEventListener, waitUntilReady } = useEventBus();

  onMounted(() => {
    addEventListener(USER_QUESTION_EVENT, handleRequested);
    addEventListener(USER_QUESTION_RESOLVED_EVENT, handleResolved);
    void waitUntilReady().catch((error) => {
      console.error("订阅用户问题事件失败:", error);
    });
  });

  onBeforeUnmount(() => {
    removeEventListener(USER_QUESTION_EVENT, handleRequested);
    removeEventListener(USER_QUESTION_RESOLVED_EVENT, handleResolved);
  });
}

export function useUserQuestion(
  workspaceId: MaybeRefOrGetter<number | undefined>,
  sessionId: MaybeRefOrGetter<string | undefined>,
) {
  const { questions, resolveQuestion } = useUserQuestionState();
  const currentQuestion = computed(() => {
    const currentWorkspaceId = toValue(workspaceId);
    const currentSessionId = toValue(sessionId);
    if (currentWorkspaceId === undefined || currentSessionId === undefined) return undefined;
    return questions.value.get(questionKey(currentWorkspaceId, currentSessionId));
  });
  return { currentQuestion, resolveQuestion };
}
