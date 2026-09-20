import {
  type CheckIn,
  type Workspace,
  type Factors,
  type Task,
  type ExecutionEvent,
  leaves,
  ready,
} from './schema';
export const WEIGHTS: Factors = {
  timeFit: 18,
  energyFit: 24,
  urgency: 14,
  priority: 10,
  impact: 10,
  dependencyValue: 6,
  contextFit: 7,
  behavior: 7,
  momentum: 4,
};
const level = { low: 1, medium: 2, high: 3 };
export function categoryRatio(events: ExecutionEvent[], category: Task['category']) {
  const history = events.filter(
    (e) => e.category === category && e.action === 'complete' && e.actualMinutes,
  );
  return history.length
    ? Math.max(
        0.5,
        Math.min(
          2,
          history.reduce((s, e) => s + e.actualMinutes! / e.estimatedMinutes, 0) / history.length,
        ),
      )
    : 1;
}
export function rank(
  workspace: Workspace,
  context: CheckIn,
  now = new Date(),
  exclude: string[] = [],
) {
  return workspace.goals
    .flatMap((goal) =>
      leaves(goal)
        .filter((t) => ready(t, goal, now) && !exclude.includes(`${goal.id}_${t.id}`))
        .map((task) => {
          const history = workspace.events.filter(
            (e) => e.category === task.category && e.action === 'complete' && e.actualMinutes,
          );
          const adjustedMinutes = Math.ceil(
            task.estimatedMinutes * categoryRatio(workspace.events, task.category),
          );
          const skips = workspace.events.filter(
            (e) =>
              e.action === 'skip' &&
              e.goalId === goal.id &&
              e.taskId === task.id &&
              e.checkIn?.energy === context.energy &&
              now.getTime() - Date.parse(e.createdAt) < 7 * 86400000,
          ).length;
          const deadline = task.deadline ?? goal.deadline;
          const days = deadline
            ? (Date.parse(deadline + 'T23:59:59Z') - now.getTime()) / 86400000
            : Infinity;
          const factors: Factors = {
            timeFit: Math.min(1, adjustedMinutes / context.availableMinutes),
            energyFit: Math.max(0, 1 - Math.abs(level[task.energy] - level[context.energy]) * 0.45),
            urgency: days <= 0 ? 1 : Math.max(0, 1 - days / 14),
            priority: (task.priority + goal.priority) / 10,
            impact: task.impact / 5,
            dependencyValue: Math.min(
              1,
              goal.tasks.filter(
                (t) =>
                  t.dependencies.includes(task.id) ||
                  t.dependencies.includes(task.parentTaskId ?? ''),
              ).length / 3,
            ),
            contextFit:
              context.interest === 'anything' ? 0.7 : context.interest === task.category ? 1 : 0,
            behavior: Math.max(0, 1 - skips * 0.35),
            momentum:
              task.status === 'in_progress'
                ? 1
                : workspace.events.some(
                      (e) =>
                        e.goalId === goal.id &&
                        e.action === 'complete' &&
                        now.getTime() - Date.parse(e.createdAt) < 86400000,
                    )
                  ? 0.7
                  : 0.2,
          };
          const score =
            Math.round(
              Object.entries(factors).reduce(
                (s, [k, v]) => s + v * WEIGHTS[k as keyof Factors],
                0,
              ) * 100,
            ) / 100;
          const evidence = [
            `This ${adjustedMinutes}-minute action fits your ${context.availableMinutes}-minute window.`,
            ...(task.energy === context.energy
              ? [`Its ${task.energy} energy requirement matches your check-in.`]
              : []),
            'Its dependencies are complete or it has no prerequisites.',
            ...(days <= 3 ? ['Its deadline is within three days or overdue.'] : []),
            ...(skips ? ['Recent skips in similar energy conditions lower its score.'] : []),
            ...(history.length
              ? ['The time estimate accounts for your completed work in this category.']
              : []),
          ];
          return { goal, task, score, factors, adjustedMinutes, evidence };
        })
        .filter((c) => c.adjustedMinutes <= context.availableMinutes),
    )
    .sort(
      (a, b) =>
        b.score - a.score || a.task.order - b.task.order || a.task.id.localeCompare(b.task.id),
    );
}
