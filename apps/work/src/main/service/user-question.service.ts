import { randomUUID } from "node:crypto";
import type { SessionTreeEntry } from "@earendil-works/pi-agent-core";
import type {
  AgentMode,
  ModelConfig,
  PermissionMode,
  UserQuestionEventPayload,
  UserQuestionResolvedEventPayload,
} from "@shared/api";
import { USER_QUESTION_EVENT, USER_QUESTION_RESOLVED_EVENT } from "@shared/constants";
import type { AskUserAnswers, AskUserRequest } from "@willow/core";
import { Injectable } from "@willow/poetry";
import { EventService } from "./event.service";
import { SessionService } from "./session.service";

const USER_QUESTION_ENTRY = "willow.user-question";

export type UserQuestionRecoveryContext = {
  agentMode?: AgentMode;
  model: ModelConfig;
  permissionMode: PermissionMode;
  userMessage: string;
};

export type PersistedUserQuestion = UserQuestionRecoveryContext & {
  payload: UserQuestionEventPayload;
};

type UserQuestionEntryData =
  | {
      version: 1;
      type: "requested";
      question: PersistedUserQuestion;
    }
  | {
      version: 1;
      type: "answered";
      requestId: string;
      answers?: AskUserAnswers;
    };

export type UserQuestionResolution = {
  question: PersistedUserQuestion;
  live: boolean;
};

type PendingQuestion = {
  question: PersistedUserQuestion;
  resolve: (answers: AskUserAnswers | undefined) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
};

@Injectable()
export class UserQuestionService {
  private readonly pending = new Map<string, PendingQuestion>();
  private readonly queue: string[] = [];
  private readonly resolving = new Set<string>();
  private readonly persistenceQueues = new Map<string, Promise<void>>();
  private activeRequestId?: string;

  constructor(
    private readonly eventService: EventService,
    private readonly sessionService: SessionService,
  ) {}

  async request(
    workspaceId: number,
    sessionId: string,
    request: AskUserRequest,
    recovery: UserQuestionRecoveryContext,
    signal?: AbortSignal,
  ): Promise<AskUserAnswers | undefined> {
    if (signal?.aborted) return undefined;
    const requestId = randomUUID();
    const payload: UserQuestionEventPayload = {
      ...request,
      requestId,
      workspaceId,
      sessionId,
    };
    const question: PersistedUserQuestion = { ...recovery, payload };
    await this.appendEntry(workspaceId, sessionId, {
      version: 1,
      type: "requested",
      question,
    });
    if (signal?.aborted) {
      await this.appendAnswer(workspaceId, sessionId, requestId);
      return undefined;
    }

    return new Promise((resolve) => {
      const item: PendingQuestion = { question, resolve, signal };
      this.pending.set(requestId, item);
      this.queue.push(requestId);
      if (signal) {
        item.onAbort = () => {
          void this.resolve(workspaceId, sessionId, requestId, undefined).catch(() => {
            this.settle(requestId, undefined);
          });
        };
        signal.addEventListener("abort", item.onAbort, { once: true });
        if (signal.aborted) {
          item.onAbort();
          return;
        }
      }
      this.dispatchNext();
    });
  }

  async resolve(
    workspaceId: number,
    sessionId: string,
    requestId: string,
    answers?: AskUserAnswers,
    mode: "live" | "recovered" = "live",
  ): Promise<UserQuestionResolution | undefined> {
    if (this.resolving.has(requestId)) return undefined;
    this.resolving.add(requestId);
    try {
      const questions = await this.getPendingQuestions(workspaceId, sessionId);
      const question = questions.find((candidate) => candidate.payload.requestId === requestId);
      if (
        !question ||
        (answers !== undefined && !this.areAnswersValid(question.payload, answers))
      ) {
        return undefined;
      }
      const hasPendingRequest = this.pending.has(requestId);
      const live = mode === "live" && hasPendingRequest;
      await this.appendAnswer(workspaceId, sessionId, requestId, answers);
      if (hasPendingRequest) this.settle(requestId, answers);
      return { question, live };
    } finally {
      this.resolving.delete(requestId);
    }
  }

  async getPendingQuestion(
    workspaceId: number,
    sessionId: string,
  ): Promise<PersistedUserQuestion | undefined> {
    return (await this.getPendingQuestions(workspaceId, sessionId))[0];
  }

  private async getPendingQuestions(
    workspaceId: number,
    sessionId: string,
  ): Promise<PersistedUserQuestion[]> {
    const branch = await this.sessionService.getBranch(workspaceId, sessionId);
    const pending = new Map<string, PersistedUserQuestion>();
    for (const entry of branch) {
      const data = this.parseEntry(entry);
      if (!data) continue;
      if (data.type === "requested") {
        pending.set(data.question.payload.requestId, data.question);
      } else {
        pending.delete(data.requestId);
      }
    }
    return [...pending.values()];
  }

  private areAnswersValid(request: UserQuestionEventPayload, answers: AskUserAnswers): boolean {
    if (Object.keys(answers).length !== request.questions.length) return false;
    return request.questions.every((question) => {
      const values = answers[question.question];
      if (!Array.isArray(values) || values.length === 0) return false;
      if (!question.multiSelect && values.length !== 1) return false;
      if (values.length > question.options.length + 1) return false;
      const normalized = values.map((value) => value.trim());
      return normalized.every(Boolean) && new Set(normalized).size === normalized.length;
    });
  }

  private settle(requestId: string, answers: AskUserAnswers | undefined): void {
    const item = this.pending.get(requestId);
    if (!item) return;
    this.pending.delete(requestId);
    if (item.signal && item.onAbort) item.signal.removeEventListener("abort", item.onAbort);
    const queueIndex = this.queue.indexOf(requestId);
    if (queueIndex >= 0) this.queue.splice(queueIndex, 1);
    if (this.activeRequestId === requestId) this.activeRequestId = undefined;
    const resolved: UserQuestionResolvedEventPayload = {
      requestId,
      workspaceId: item.question.payload.workspaceId,
      sessionId: item.question.payload.sessionId,
    };
    this.eventService.sendEvent(USER_QUESTION_RESOLVED_EVENT, resolved);
    item.resolve(answers);
    this.dispatchNext();
  }

  private dispatchNext(): void {
    if (this.activeRequestId) return;
    const requestId = this.queue[0];
    if (!requestId) return;
    const item = this.pending.get(requestId);
    if (!item) {
      this.queue.shift();
      this.dispatchNext();
      return;
    }
    this.activeRequestId = requestId;
    this.eventService.sendEvent(USER_QUESTION_EVENT, item.question.payload);
  }

  private appendAnswer(
    workspaceId: number,
    sessionId: string,
    requestId: string,
    answers?: AskUserAnswers,
  ): Promise<string> {
    return this.appendEntry(workspaceId, sessionId, {
      version: 1,
      type: "answered",
      requestId,
      answers,
    });
  }

  private appendEntry(
    workspaceId: number,
    sessionId: string,
    data: UserQuestionEntryData,
  ): Promise<string> {
    const key = `${workspaceId}:${sessionId}`;
    const previous = this.persistenceQueues.get(key) ?? Promise.resolve();
    const operation = previous.then(() =>
      this.sessionService.appendCustomEntry(workspaceId, sessionId, USER_QUESTION_ENTRY, data),
    );
    const tail = operation.then(
      () => undefined,
      () => undefined,
    );
    this.persistenceQueues.set(key, tail);
    void tail.finally(() => {
      if (this.persistenceQueues.get(key) === tail) this.persistenceQueues.delete(key);
    });
    return operation;
  }

  private parseEntry(entry: SessionTreeEntry): UserQuestionEntryData | undefined {
    if (
      entry.type !== "custom" ||
      entry.customType !== USER_QUESTION_ENTRY ||
      !entry.data ||
      typeof entry.data !== "object"
    ) {
      return undefined;
    }
    const data = entry.data as Partial<UserQuestionEntryData>;
    if (data.version !== 1 || (data.type !== "requested" && data.type !== "answered")) {
      return undefined;
    }
    return data as UserQuestionEntryData;
  }
}
