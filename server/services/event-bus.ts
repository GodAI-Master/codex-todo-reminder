export type TodoEvent = {
  type: "todo.changed" | "list.changed" | "settings.changed";
  id?: string;
  at: string;
};

type Listener = (event: TodoEvent) => void;

export class EventBus {
  private readonly listeners = new Set<Listener>();

  emit(event: Omit<TodoEvent, "at">): void {
    const complete = { ...event, at: new Date().toISOString() };
    for (const listener of this.listeners) listener(complete);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
