import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { goalInputSchema, validatePlan, progress, type Goal, type Plan } from '../../domain/schema';
import { workspace } from '../workspace';
import { AppError } from '../errors';
import type { DomainHandler } from '../service-context';
export const goalsDomain: DomainHandler = async (ctx, user, method, path, body) => {
  const [domain, key] = path.split('/').filter(Boolean);
  const now = new Date().toISOString();
  if (domain === 'goals') {
    if (method === 'POST' && !key) {
      const input = goalInputSchema.parse(body);
      const goal: Goal = {
        ...input,
        id: randomUUID(),
        phases: [],
        tasks: [],
        status: 'draft',
        createdAt: now,
        updatedAt: now,
        revision: 1,
      };
      await ctx.repo.commit(user, [{ kind: 'goal', id: goal.id, data: goal, expectedRevision: 0 }]);
      return goal;
    }
    if (method === 'GET' && !key) return (await workspace(ctx.repo, user)).goals;
    const { data: goal, revision } = await ctx.get<Goal>(user, 'goal', key);
    if (method === 'GET') return goal;
    if (method === 'PATCH') {
      const input = z
        .object({
          revision: z.number().int(),
          details: goalInputSchema.optional(),
          plan: z.unknown().optional(),
          status: z.enum(['active', 'archived', 'completed']).optional(),
        })
        .parse(body);
      if (input.revision !== revision)
        throw new AppError(409, 'Your plan changed. Refresh before editing.');
      let plan: Plan = goal;
      if (input.plan) {
        try {
          plan = validatePlan(input.plan);
        } catch (e) {
          throw new AppError(400, e instanceof Error ? e.message : 'Invalid plan');
        }
        for (const t of goal.tasks) {
          if (
            t.status === 'completed' &&
            JSON.stringify(plan.tasks.find((p) => p.id === t.id)) !== JSON.stringify(t)
          )
            throw new AppError(409, 'Completed work is preserved. Edit unfinished tasks instead.');
          const edited = plan.tasks.find((p) => p.id === t.id);
          if (
            edited &&
            (edited.status !== t.status ||
              edited.startedAt !== t.startedAt ||
              edited.completedAt !== t.completedAt ||
              edited.postponedUntil !== t.postponedUntil)
          )
            throw new AppError(400, 'Use execution actions to change task state.');
        }
        for (const t of plan.tasks.filter((t) => !goal.tasks.some((old) => old.id === t.id))) {
          if (t.status !== 'pending' || t.startedAt || t.completedAt || t.postponedUntil)
            throw new AppError(400, 'New tasks must be pending.');
        }
      }
      if (input.status === 'active' && !plan.tasks.length)
        throw new AppError(400, 'Generate or add a plan before activating.');
      if (input.status === 'completed' && progress(plan).percent !== 100)
        throw new AppError(400, 'Finish the remaining work before completing this goal.');
      const updated = {
        ...goal,
        ...input.details,
        phases: plan.phases,
        tasks: plan.tasks,
        status: input.status ?? goal.status,
        revision: revision + 1,
        updatedAt: now,
      };
      await ctx.repo.commit(user, [
        { kind: 'goal', id: key, data: updated, expectedRevision: revision },
      ]);
      return updated;
    }
  }
  throw new AppError(404, 'Endpoint not found.');
};
