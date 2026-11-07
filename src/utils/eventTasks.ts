/**
 * Events.
 *
 * An event is a calendar item that should also trigger reminders but should not clutter the task
 * lists (Kanban board, assignments, stats). To work with every Veyro database (the built-in local
 * one and a user's own Supabase project, whose columns cannot be changed from the app), events are
 * stored as ordinary rows in `tasks` and marked with this reserved assignment name.
 *
 *  - The calendar and the reminder engine read all rows, so events show up there.
 *  - Task-style screens use `useRegularTasks()`, which hides rows where `isEventTask` is true.
 */
export const EVENT_ASSIGNMENT = '📅 Events';

export const isEventTask = (task: { assignment?: string | null | undefined }): boolean =>
  task.assignment === EVENT_ASSIGNMENT;
