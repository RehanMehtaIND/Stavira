import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  adaptationProposalSchema,
  leaves,
  validatePlan,
  type Goal,
  type Adaptation,
} from '../../domain/schema';
import { taskDefaults } from '../../domain/task';
import { workspace } from '../workspace';
import { AppError } from '../errors';
import type { DomainHandler } from '../service-context';
export const adaptationDomain: DomainHandler = async (ctx, user, method, path, body) => {
  const [domain, key, action] = path.split('/').filter(Boolean);
  const now = new Date().toISOString();
  if (domain === 'adaptations' && method === 'POST' && !action) {
    const { data: goal, revision } = await ctx.get<Goal>(user, 'goal', key);
    if (goal.status !== 'active') throw new AppError(409, 'Only active goals can be adapted.');
    const { reason } = z.object({ reason: z.string().min(1).max(1000) }).parse(body);
    const state = await workspace(ctx.repo, user);
    const proposal = adaptationProposalSchema.parse(await ctx.ai.adapt(goal, reason, state));
    if (
      new Set(proposal.changes.map((c) => c.taskId)).size !== proposal.changes.length ||
      proposal.changes.some(
        (c) =>
          !leaves(goal).some((t) => t.id === c.taskId && t.status !== 'completed') ||
          (!c.preparation &&
            c.energy === undefined &&
            c.priority === undefined &&
            c.estimatedMinutes === undefined),
      )
    )
      throw new AppError(502, 'AI proposed an invalid change. Retry adaptation.');
    const adaptation: Adaptation = {
      ...proposal,
      id: randomUUID(),
      goalId: key,
      reason,
      status: 'proposed',
      baseRevision: revision,
      createdAt: now,
      before: { tasks: goal.tasks, phases: goal.phases },
    };
    await ctx.repo.commit(user, [
      { kind: 'adaptation', id: adaptation.id, data: adaptation, expectedRevision: 0 },
    ]);
    return adaptation;
  }
  if (domain === 'adaptations' && method === 'POST' && ['accept', 'dismiss'].includes(action)) {
    const { data: adaptation, revision: ar } = await ctx.get<Adaptation>(user, 'adaptation', key);
    if (adaptation.status !== 'proposed')
      throw new AppError(409, 'This proposal was already reviewed.');
    if (action === 'dismiss') {
      await ctx.repo.commit(user, [
        {
          kind: 'adaptation',
          id: key,
          data: { ...adaptation, status: 'dismissed' },
          expectedRevision: ar,
        },
      ]);
      return { ok: true };
    }
    const { data: goal, revision } = await ctx.get<Goal>(user, 'goal', adaptation.goalId);
    if (goal.status !== 'active' || revision !== adaptation.baseRevision)
      throw new AppError(409, 'The plan changed after this proposal. Generate a fresh adaptation.');
    let tasks = structuredClone(goal.tasks);
    for (const change of adaptation.changes) {
      const target = tasks.find((t) => t.id === change.taskId)!;
      if (target.status === 'completed') throw new AppError(409, 'Completed work cannot change.');
      if (change.estimatedMinutes) target.estimatedMinutes = change.estimatedMinutes;
      if (change.energy) target.energy = change.energy;
      if (change.priority) target.priority = change.priority;
      if (change.preparation) {
        const prep = taskDefaults(randomUUID(), target.phaseId, change.preparation.title, {
          ...change.preparation,
          parentTaskId: target.parentTaskId,
          dependencies: [...target.dependencies],
          order: target.order,
          priority: 5,
          impact: target.impact,
        });
        tasks = [...tasks, prep];
        target.dependencies = [prep.id];
        target.status = 'pending';
        target.postponedUntil = null;
      }
    }
    const plan = validatePlan({ phases: goal.phases, tasks });
    const updated = { ...goal, ...plan, revision: revision + 1, updatedAt: now };
    await ctx.repo.commit(user, [
      { kind: 'goal', id: goal.id, data: updated, expectedRevision: revision },
      {
        kind: 'adaptation',
        id: key,
        data: { ...adaptation, status: 'accepted', after: plan },
        expectedRevision: ar,
      },
    ]);
    return updated;
  }
  throw new AppError(404, 'Endpoint not found.');
};
