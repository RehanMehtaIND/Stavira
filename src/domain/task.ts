import type { Task } from './schema';
export function taskDefaults(
  id: string,
  phaseId: string,
  title: string,
  extra: Partial<Task> = {},
): Task {
  return {
    id,
    phaseId,
    parentTaskId: null,
    title,
    description: `Complete a concrete first version of: ${title.toLowerCase()}. Keep the scope small enough for one session.`,
    estimatedMinutes: 20,
    energy: 'low',
    priority: 3,
    impact: 3,
    category: 'planning',
    dependencies: [],
    deadline: null,
    order: 0,
    status: 'pending',
    postponedUntil: null,
    startedAt: null,
    completedAt: null,
    ...extra,
  };
}
