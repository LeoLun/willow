import { EventService } from "@main/service/event.service";
import { TODO_UPDATED } from "@shared/constants";
import type { TodoItem, TodoStore } from "@willow/core";
import { Injectable } from "@willow/poetry";

@Injectable()
export class TodoService {
  private todos = new Map<number, TodoItem[]>();

  constructor(private readonly eventService: EventService) {}

  createStore(sessionId: number): TodoStore {
    return {
      get: () => this.todos.get(sessionId) ?? [],
      update: (todos: TodoItem[]) => {
        this.todos.set(sessionId, todos);
        this.eventService.sendEvent(TODO_UPDATED, { sessionId, todos });
      },
    };
  }

  getTodos(sessionId: number): TodoItem[] {
    return this.todos.get(sessionId) ?? [];
  }

  clearSession(sessionId: number): void {
    this.todos.delete(sessionId);
  }
}
