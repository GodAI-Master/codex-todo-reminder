import type { Todo } from "../domain/todo.js";
import type { Occurrence } from "../services/occurrence-service.js";

export type ReminderNotification = {
  todo: Todo;
  occurrence: Occurrence;
  missed: boolean;
};

export interface ReminderNotifier {
  send(notification: ReminderNotification): Promise<void>;
}
