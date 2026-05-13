export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
}

export interface TodoStore {
  get(): TodoItem[];
  update(todos: TodoItem[]): void;
}
