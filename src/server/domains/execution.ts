import {
  eventInputSchema,
  leaves,
  ready,
  progress,
  type Goal,
  type ExecutionEvent,
  type Recommendation,
} from '../../domain/schema';
import type { Write } from '../repositories/types';
import { workspace } from '../workspace';
import { AppError } from '../errors';
import type { DomainHandler } from '../service-context';
export const executionDomain: DomainHandler = async (ctx, user, method, path, body) => {
  const [domain] = path.split('/').filter(Boolean);
  const now = new Date().toISOString();
  if (domain === 'execution' && method === 'POST') {
    const input = eventInputSchema.parse(body);
    const existing = await ctx.repo.get(user, 'event', input.requestId);
    if (existing) return existing.data;
    const { data: goal, revision } = await ctx.get<Goal>(user, 'goal', input.goalId);
    const task = leaves(goal).find((t) => t.id === input.taskId);
    if (!task) throw new AppError(404, 'Executable task not found.');
    if (goal.status !== 'active' || task.status === 'completed')
      throw new AppError(409, 'This task is no longer actionable.');
    if (['start', 'complete'].includes(input.action) && !ready(task, goal, new Date(now)))
      throw new AppError(409, 'Resolve dependencies or postponement before starting this task.');
    if (input.action === 'start' && task.status === 'in_progress')
      throw new AppError(409, 'This task is already in progress.');
    if (
      input.action === 'postpone' &&
      (!input.postponedUntil || Date.parse(input.postponedUntil) <= Date.parse(now))
    )
      throw new AppError(400, 'Choose a future time.');
    const state = await workspace(ctx.repo, user);
    const context = state.checkIns.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const actualMinutes =
      input.action === 'complete'
        ? (input.actualMinutes ??
          (task.startedAt
            ? Math.max(0.1, (Date.parse(now) - Date.parse(task.startedAt)) / 60000)
            : undefined))
        : undefined;
    const event: ExecutionEvent = {
      id: input.requestId,
      goalId: goal.id,
      taskId: task.id,
      taskTitle: task.title,
      category: task.category,
      action: input.action,
      createdAt: now,
      estimatedMinutes: task.estimatedMinutes,
      actualMinutes,
      reason: input.reason,
      recommendationId: input.recommendationId,
      checkIn: context,
      postponedUntil: input.postponedUntil,
    };
    const changed = {
      ...task,
      status:
        input.action === 'start'
          ? 'in_progress'
          : input.action === 'complete'
            ? 'completed'
            : input.action === 'skip'
              ? input.reason === 'Missing something'
                ? 'blocked'
                : 'skipped'
              : 'postponed',
      startedAt: input.action === 'start' ? now : task.startedAt,
      completedAt: input.action === 'complete' ? now : null,
      postponedUntil: input.action === 'postpone' ? input.postponedUntil! : null,
    } as typeof task;
    const updated: Goal = {
      ...goal,
      tasks: goal.tasks.map((t) => (t.id === task.id ? changed : t)),
      revision: revision + 1,
      updatedAt: now,
    };
    if (progress(updated).percent === 100) updated.status = 'completed';
    const writes: Write[] = [
      { kind: 'goal', id: goal.id, data: updated, expectedRevision: revision },
      { kind: 'event', id: event.id, data: event, expectedRevision: 0 },
    ];
    if (input.recommendationId) {
      const rec = await ctx.get<Recommendation>(user, 'recommendation', input.recommendationId);
      if (rec.data.goalId !== goal.id || rec.data.taskId !== task.id)
        throw new AppError(400, 'Recommendation does not match this task.');
      writes.push({
        kind: 'recommendation',
        id: rec.data.id,
        expectedRevision: rec.revision,
        data: {
          ...rec.data,
          status:
            input.action === 'start'
              ? 'accepted'
              : input.action === 'complete'
                ? 'completed'
                : 'rejected',
        },
      });
    }
    await ctx.repo.commit(user, writes);
    return event;
  }
  throw new AppError(404, 'Endpoint not found.');
};
